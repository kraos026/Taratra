import { z } from "zod";
import {
  missionRequestSchema,
  planningContextSchema,
  pluginContractSchema,
  workflowDocumentSchema,
  type CapabilityContract,
  type PluginContract,
  type WorkflowDocument,
  type WorkflowNode,
} from "./orchestration-contracts";

export type ContractIssue = { code: string; nodeId?: string };
type Port = CapabilityContract["inputs"][number];
type NodePorts = { inputs: Port[]; outputs: Port[] };
const issue = (code: string, nodeId?: string): ContractIssue =>
  nodeId ? { code, nodeId } : { code };
const pluginKey = (id: string, version: string) => `${id}@${version}`;

export function capabilityFor(node: WorkflowNode, plugins: readonly PluginContract[]) {
  return node.kind === "capability"
    ? plugins
        .find((plugin) => plugin.id === node.pluginId && plugin.version === node.pluginVersion)
        ?.capabilities.find((capability) => capability.id === node.capabilityId)
    : undefined;
}
export function nodePorts(
  node: WorkflowNode,
  plugins: readonly PluginContract[],
): NodePorts | null {
  if (node.kind === "input")
    return { inputs: [], outputs: [{ id: "value", type: node.value.type }] };
  if (node.kind === "capability") {
    const capability = capabilityFor(node, plugins);
    return capability ? { inputs: capability.inputs, outputs: capability.outputs } : null;
  }
  if (node.kind === "human-review")
    return {
      inputs: [{ id: "content", type: "artifact" }],
      outputs: [
        { id: "content", type: "artifact" },
        { id: "approval", type: "approval" },
      ],
    };
  if (node.kind === "deliverable")
    return { inputs: [{ id: "content", type: "artifact" }], outputs: [] };
  return {
    inputs: [
      {
        id: "value",
        type:
          node.operation === "extract-text"
            ? "artifact"
            : node.operation === "draft-team"
              ? "team-brief"
              : "text",
      },
    ],
    outputs: [{ id: "value", type: node.operation === "extract-text" ? "text" : "artifact" }],
  };
}

/** Shape and graph checks only. This function never calls an engine. */
export function validateWorkflowDefinition(
  candidate: unknown,
  catalog: unknown,
):
  | { ok: true; workflow: WorkflowDocument; plugins: PluginContract[]; order: string[] }
  | { ok: false; issues: ContractIssue[] } {
  const parsed = workflowDocumentSchema.safeParse(candidate);
  const parsedPlugins = z.array(pluginContractSchema).max(32).safeParse(catalog);
  if (!parsed.success || !parsedPlugins.success)
    return { ok: false, issues: [issue("INVALID_CONTRACT")] };
  const workflow = parsed.data,
    plugins = parsedPlugins.data;
  const issues: ContractIssue[] = [];
  const pluginKeys = plugins.map((plugin) => pluginKey(plugin.id, plugin.version));
  if (new Set(pluginKeys).size !== pluginKeys.length)
    issues.push(issue("DUPLICATE_PLUGIN_VERSION"));
  const nodes = new Map(workflow.nodes.map((node) => [node.id, node]));
  if (nodes.size !== workflow.nodes.length) issues.push(issue("DUPLICATE_NODE"));
  if (new Set(workflow.edges.map((edge) => edge.id)).size !== workflow.edges.length)
    issues.push(issue("DUPLICATE_EDGE"));
  const positions = workflow.presentation.positions.map((position) => position.nodeId);
  if (new Set(positions).size !== positions.length || positions.some((id) => !nodes.has(id)))
    issues.push(issue("INVALID_PRESENTATION_REFERENCE"));
  if (
    !workflow.nodes.some((node) => node.kind === "input") ||
    !workflow.nodes.some((node) => node.kind === "deliverable")
  )
    issues.push(issue("MISSING_INPUT_OR_DELIVERABLE"));
  const shapes = new Map(workflow.nodes.map((node) => [node.id, nodePorts(node, plugins)]));
  for (const node of workflow.nodes)
    if (!shapes.get(node.id)) issues.push(issue("UNKNOWN_CAPABILITY_VERSION", node.id));
  const incoming = new Map<string, Set<string>>();
  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();
  const indegree = new Map(workflow.nodes.map((node) => [node.id, 0]));
  for (const edge of workflow.edges) {
    const from = nodes.get(edge.from.nodeId),
      to = nodes.get(edge.to.nodeId);
    if (!from || !to) {
      issues.push(issue("UNKNOWN_NODE_REFERENCE"));
      continue;
    }
    const output = shapes.get(from.id)?.outputs.find((port) => port.id === edge.from.portId);
    const input = shapes.get(to.id)?.inputs.find((port) => port.id === edge.to.portId);
    if (!output || !input) issues.push(issue("UNKNOWN_PORT", to.id));
    else if (output.type !== input.type) issues.push(issue("PORT_TYPE_MISMATCH", to.id));
    else if (input.type === "approval" && from.kind !== "human-review")
      issues.push(issue("INVALID_APPROVAL_SOURCE", to.id));
    const used = incoming.get(to.id) || new Set<string>();
    if (used.has(edge.to.portId)) issues.push(issue("MULTIPLE_INPUT_BINDINGS", to.id));
    used.add(edge.to.portId);
    incoming.set(to.id, used);
    children.set(from.id, [...(children.get(from.id) || []), to.id]);
    parents.set(to.id, [...(parents.get(to.id) || []), from.id]);
    indegree.set(to.id, (indegree.get(to.id) || 0) + 1);
  }
  for (const node of workflow.nodes)
    for (const port of shapes.get(node.id)?.inputs || [])
      if (!incoming.get(node.id)?.has(port.id))
        issues.push(issue("MISSING_INPUT_BINDING", node.id));
  const queue = [...indegree]
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id)
    .sort();
  const order: string[] = [],
    depth = new Map<string, number>();
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    const level = depth.get(id) || 1;
    if (level > 32) issues.push(issue("GRAPH_TOO_DEEP", id));
    for (const child of children.get(id) || []) {
      depth.set(child, Math.max(depth.get(child) || 1, level + 1));
      const degree = (indegree.get(child) || 0) - 1;
      indegree.set(child, degree);
      if (degree === 0) {
        queue.push(child);
        queue.sort();
      }
    }
  }
  if (order.length !== nodes.size) issues.push(issue("CYCLE_DETECTED"));
  const reachesOutput = new Set<string>();
  const reverse = workflow.nodes
    .filter((node) => node.kind === "deliverable")
    .map((node) => node.id);
  while (reverse.length) {
    const id = reverse.pop()!;
    if (reachesOutput.has(id)) continue;
    reachesOutput.add(id);
    reverse.push(...(parents.get(id) || []));
  }
  for (const node of workflow.nodes)
    if (!reachesOutput.has(node.id)) issues.push(issue("UNUSED_NODE", node.id));
  return issues.length ? { ok: false, issues } : { ok: true, workflow, plugins, order };
}

/** Read-only assessment, not an execution authorization or a runtime entry point. */
export function assessPlanRequirements(
  missionCandidate: unknown,
  workflowCandidate: unknown,
  catalog: unknown,
  serverContext: unknown,
) {
  const definition = validateWorkflowDefinition(workflowCandidate, catalog);
  const mission = missionRequestSchema.safeParse(missionCandidate);
  const context = planningContextSchema.safeParse(serverContext);
  const issues: ContractIssue[] = definition.ok ? [] : [...definition.issues];
  if (!mission.success || !context.success) issues.push(issue("INVALID_MISSION_OR_SERVER_CONTEXT"));
  if (!definition.ok || !mission.success || !context.success)
    return { status: "blocked" as const, issues, executes: false as const };
  const request = mission.data,
    scope = context.data;
  if (
    request.workflow.id !== definition.workflow.id ||
    request.workflow.revision !== definition.workflow.revision
  )
    issues.push(issue("WORKFLOW_REVISION_MISMATCH"));
  if (!scope.canWrite) issues.push(issue("WRITE_ACCESS_REQUIRED"));
  if (request.policy.autonomy === null) issues.push(issue("AUTONOMY_UNSET"));
  for (const node of definition.workflow.nodes) {
    if (node.kind === "input" && node.value.type === "audit-ref") {
      const value = node.value;
      if (
        !scope.authorizedAudits.some(
          (ref) =>
            ref.companyId === value.companyId &&
            ref.auditId === value.auditId &&
            ref.resultVersion === value.resultVersion,
        )
      )
        issues.push(issue("AUDIT_REFERENCE_NOT_AUTHORIZED", node.id));
    }
    if (node.kind === "input" && node.value.type === "workflow-ref") {
      const value = node.value;
      if (
        !scope.authorizedWorkflows.some(
          (ref) => ref.connectionRef === value.connectionRef && ref.workflowId === value.workflowId,
        )
      )
        issues.push(issue("WORKFLOW_REFERENCE_NOT_AUTHORIZED", node.id));
    }
    if (node.kind !== "capability") continue;
    const capability = capabilityFor(node, definition.plugins)!;
    if (
      !scope.installedPlugins.some(
        (plugin) => plugin.id === node.pluginId && plugin.version === node.pluginVersion,
      )
    )
      issues.push(issue("PLUGIN_NOT_INSTALLED", node.id));
    if (
      capability.permissionsRequested.some(
        (permission) => !scope.permissionsGranted.includes(permission),
      )
    )
      issues.push(issue("PERMISSION_NOT_GRANTED", node.id));
    if (
      !scope.bindings.some(
        (binding) =>
          binding.workspaceId === scope.workspaceId &&
          binding.engineId === capability.engine.id &&
          binding.capability === capability.engine.capability,
      )
    )
      issues.push(issue("ENGINE_NOT_BOUND_TO_WORKSPACE", node.id));
    if (capability.effect === "write" && request.policy.autonomy !== "scoped")
      issues.push(issue("SCOPED_MODE_REQUIRED", node.id));
  }
  return {
    status: issues.length ? ("blocked" as const) : ("requirements-satisfied" as const),
    issues,
    executes: false as const,
  };
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b, "en"))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
/** Deterministic input for future hashing, not a signature; never log customer contents. */
export function canonicalPlanDefinition(
  missionCandidate: unknown,
  workflowCandidate: unknown,
  catalog: unknown,
) {
  const definition = validateWorkflowDefinition(workflowCandidate, catalog);
  const mission = missionRequestSchema.safeParse(missionCandidate);
  if (
    !definition.ok ||
    !mission.success ||
    mission.data.workflow.id !== definition.workflow.id ||
    mission.data.workflow.revision !== definition.workflow.revision
  )
    throw new Error("Invalid plan definition");
  const referenced = new Set(
    definition.workflow.nodes
      .filter((node) => node.kind === "capability")
      .map((node) => pluginKey(node.pluginId, node.pluginVersion)),
  );
  return JSON.stringify(
    canonical({
      mission: mission.data,
      workflow: {
        contractVersion: definition.workflow.contractVersion,
        id: definition.workflow.id,
        revision: definition.workflow.revision,
        nodes: [...definition.workflow.nodes].sort((a, b) => a.id.localeCompare(b.id, "en")),
        edges: [...definition.workflow.edges].sort((a, b) => a.id.localeCompare(b.id, "en")),
      },
      plugins: definition.plugins
        .filter((plugin) => referenced.has(pluginKey(plugin.id, plugin.version)))
        .sort((a, b) => pluginKey(a.id, a.version).localeCompare(pluginKey(b.id, b.version), "en")),
    }),
  );
}
