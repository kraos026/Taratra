import { describe, expect, it } from "vitest";
import {
  missionRequestSchema,
  pluginContractSchema,
  workflowDocumentSchema,
  type PlanningContext,
  type WorkflowDocument,
} from "./orchestration-contracts";
import {
  assessPlanRequirements,
  canonicalPlanDefinition,
  validateWorkflowDefinition,
} from "./workflow-validation";
import { referencePluginContracts, referenceWorkflows } from "./reference-workflows";

const clone = <T>(value: T): T => structuredClone(value);
const generic = referenceWorkflows.generalHermes;
function context(): PlanningContext {
  const workspaceId = "50000000-0000-4000-8000-000000000001";
  return {
    workspaceId,
    canWrite: true,
    permissionsGranted: ["audit.read", "agent.run", "workflow.run", "team.manage"],
    installedPlugins: referencePluginContracts.map(({ id, version }) => ({ id, version })),
    bindings: referencePluginContracts.flatMap((plugin) =>
      plugin.capabilities.map((capability) => ({
        workspaceId,
        engineId: capability.engine.id,
        capability: capability.engine.capability,
      })),
    ),
    authorizedAudits: [
      {
        companyId: "20000000-0000-4000-8000-000000000001",
        auditId: "30000000-0000-4000-8000-000000000001",
        resultVersion: 1,
      },
    ],
    authorizedWorkflows: [
      { connectionRef: "40000000-0000-4000-8000-000000000001", workflowId: "pilot-internal-brief" },
    ],
  };
}
function codes(workflow: unknown, plugins: unknown = referencePluginContracts) {
  const result = validateWorkflowDefinition(workflow, plugins);
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}
describe("versioned orchestration contracts", () => {
  it("validates all four complete definitions without granting execution or installing their plugins", () => {
    for (const example of Object.values(referenceWorkflows)) {
      const result = validateWorkflowDefinition(example.workflow, referencePluginContracts);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.order).toHaveLength(example.workflow.nodes.length);
      expect(
        assessPlanRequirements(
          example.mission,
          example.workflow,
          referencePluginContracts,
          context(),
        ),
      ).toEqual({ status: "requirements-satisfied", issues: [], executes: false });
    }
    expect(
      generic.workflow.nodes.some(
        (node) => node.kind === "input" && node.value.type === "audit-ref",
      ),
    ).toBe(false);
    const scope = context();
    scope.installedPlugins = [];
    scope.bindings = [];
    scope.permissionsGranted = [];
    const result = assessPlanRequirements(
      generic.mission,
      generic.workflow,
      referencePluginContracts,
      scope,
    );
    expect(result.status).toBe("blocked");
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "PLUGIN_NOT_INSTALLED",
        "PERMISSION_NOT_GRANTED",
        "ENGINE_NOT_BOUND_TO_WORKSPACE",
      ]),
    );
    expect(result.executes).toBe(false);
  });
  it("uses a stable definition across all entry modes, views, coordinates and array order", () => {
    const original = canonicalPlanDefinition(
      generic.mission,
      generic.workflow,
      referencePluginContracts,
    );
    for (const entryMode of ["chat", "template", "canvas"] as const)
      for (const view of ["simple", "advanced"] as const) {
        const graph = clone(generic.workflow);
        graph.presentation = {
          entryMode,
          view,
          positions: graph.presentation.positions.map((position) => ({
            ...position,
            x: -position.x,
            y: 400,
          })),
        };
        graph.nodes.reverse();
        graph.edges.reverse();
        graph.title = "Libellé de présentation";
        expect(
          canonicalPlanDefinition(generic.mission, graph, [...referencePluginContracts].reverse()),
        ).toBe(original);
      }
  });
  it("changes the definition when the objective, payload, policy or referenced contract changes", () => {
    const original = canonicalPlanDefinition(
      generic.mission,
      generic.workflow,
      referencePluginContracts,
    );
    const graph = clone(generic.workflow);
    const node = graph.nodes.find((item) => item.kind === "input")!;
    if (node.kind === "input" && node.value.type === "text")
      node.value.text = "Préparer un autre livrable.";
    expect(canonicalPlanDefinition(generic.mission, graph, referencePluginContracts)).not.toBe(
      original,
    );
    expect(
      canonicalPlanDefinition(
        { ...generic.mission, objective: "Préparer une nouvelle procédure interne" },
        generic.workflow,
        referencePluginContracts,
      ),
    ).not.toBe(original);
    expect(
      canonicalPlanDefinition(
        { ...generic.mission, policy: { ...generic.mission.policy, autonomy: "scoped" } },
        generic.workflow,
        referencePluginContracts,
      ),
    ).not.toBe(original);
    const catalog = clone(referencePluginContracts);
    catalog
      .find((plugin) => plugin.id === "hermes.text")!
      .capabilities[0].permissionsRequested.push("audit.read");
    expect(canonicalPlanDefinition(generic.mission, generic.workflow, catalog)).not.toBe(original);
  });
  it("rejects node/edge duplicates, dangling endpoints, missing and multiply bound inputs", () => {
    const graph = clone(generic.workflow);
    graph.nodes.push(graph.nodes[0]);
    expect(codes(graph)).toContain("DUPLICATE_NODE");
    const duplicate = clone(generic.workflow);
    duplicate.edges.push(duplicate.edges[0]);
    expect(codes(duplicate)).toContain("DUPLICATE_EDGE");
    expect(codes(duplicate)).toContain("MULTIPLE_INPUT_BINDINGS");
    const dangling = clone(generic.workflow);
    dangling.edges[0].from.nodeId = "missing-node";
    expect(codes(dangling)).toContain("UNKNOWN_NODE_REFERENCE");
    const missing = clone(generic.workflow);
    missing.edges.shift();
    expect(codes(missing)).toContain("MISSING_INPUT_BINDING");
  });
  it("rejects invalid ports, incompatible types and hidden unused executable nodes", () => {
    const graph = clone(generic.workflow);
    graph.edges[0].to.portId = "unknown-port";
    expect(codes(graph)).toContain("UNKNOWN_PORT");
    const mismatch = clone(generic.workflow);
    mismatch.edges[0].to = { nodeId: "deliverable", portId: "content" };
    expect(codes(mismatch)).toContain("PORT_TYPE_MISMATCH");
    const unused = clone(generic.workflow);
    unused.nodes.push({
      id: "hidden-step",
      kind: "input",
      value: { type: "text", text: "Non relié au livrable" },
    });
    expect(codes(unused)).toContain("UNUSED_NODE");
  });
  it("rejects cycles and overly deep DAGs without recursive evaluation", () => {
    const graph = clone(generic.workflow);
    graph.nodes.push({ id: "extract-loop", kind: "transform", operation: "extract-text" });
    graph.edges[0].from = { nodeId: "extract-loop", portId: "value" };
    graph.edges.push({
      id: "loop-back",
      from: { nodeId: "draft-text", portId: "result" },
      to: { nodeId: "extract-loop", portId: "value" },
    });
    expect(codes(graph)).toContain("CYCLE_DETECTED");
    const deep = clone(generic.workflow);
    deep.nodes = [
      { id: "source", kind: "input", value: { type: "text", text: "Exemple de donnée" } },
    ];
    deep.edges = [];
    let previous = "source";
    for (let index = 0; index < 35; index++) {
      const id = `step-${index}`;
      deep.nodes.push({
        id,
        kind: "transform",
        operation: index % 2 === 0 ? "draft-text" : "extract-text",
      });
      deep.edges.push({
        id: `edge-${index}`,
        from: { nodeId: previous, portId: "value" },
        to: { nodeId: id, portId: "value" },
      });
      previous = id;
    }
    deep.nodes.push({ id: "deliverable", kind: "deliverable", label: "Sortie" });
    deep.edges.push({
      id: "last-edge",
      from: { nodeId: previous, portId: "value" },
      to: { nodeId: "deliverable", portId: "content" },
    });
    deep.presentation.positions = [];
    expect(codes(deep)).toContain("GRAPH_TOO_DEEP");
  });
  it("enforces graph bounds, finite coordinates and valid presentation references", () => {
    const graph = clone(generic.workflow);
    graph.presentation.positions[0].nodeId = "missing-node";
    expect(codes(graph)).toContain("INVALID_PRESENTATION_REFERENCE");
    const duplicate = clone(generic.workflow);
    duplicate.presentation.positions.push(duplicate.presentation.positions[0]);
    expect(codes(duplicate)).toContain("INVALID_PRESENTATION_REFERENCE");
    const infinite = clone(generic.workflow);
    infinite.presentation.positions[0].x = Infinity;
    expect(workflowDocumentSchema.safeParse(infinite).success).toBe(false);
    expect(
      workflowDocumentSchema.safeParse({
        ...generic.workflow,
        nodes: Array(65).fill(generic.workflow.nodes[0]),
      }).success,
    ).toBe(false);
    expect(
      workflowDocumentSchema.safeParse({
        ...generic.workflow,
        edges: Array(129).fill(generic.workflow.edges[0]),
      }).success,
    ).toBe(false);
  });
  it("requires exact capability and installed package versions", () => {
    for (const version of ["latest", "^0.1.0", "0.x", "00.1.0"])
      expect(
        pluginContractSchema.safeParse({ ...referencePluginContracts[0], version }).success,
      ).toBe(false);
    const graph = clone(generic.workflow);
    const node = graph.nodes.find((item) => item.kind === "capability")!;
    if (node.kind === "capability") node.pluginVersion = "9.0.0";
    expect(codes(graph)).toContain("UNKNOWN_CAPABILITY_VERSION");
    expect(
      codes(generic.workflow, [...referencePluginContracts, referencePluginContracts[0]]),
    ).toContain("DUPLICATE_PLUGIN_VERSION");
    const scope = context();
    scope.installedPlugins = scope.installedPlugins.map((plugin) => ({
      ...plugin,
      version: "9.0.0",
    }));
    expect(
      assessPlanRequirements(
        generic.mission,
        generic.workflow,
        referencePluginContracts,
        scope,
      ).issues.map((issue) => issue.code),
    ).toContain("PLUGIN_NOT_INSTALLED");
  });
  it("blocks missing autonomy and read-only users, without choosing a default or copying manifest permissions", () => {
    const scope = context();
    scope.canWrite = false;
    scope.permissionsGranted = [];
    const mission = { ...generic.mission, policy: { ...generic.mission.policy, autonomy: null } };
    const result = assessPlanRequirements(
      mission,
      generic.workflow,
      referencePluginContracts,
      scope,
    );
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["AUTONOMY_UNSET", "WRITE_ACCESS_REQUIRED", "PERMISSION_NOT_GRANTED"]),
    );
    expect(result.executes).toBe(false);
    expect(mission.policy.autonomy).toBeNull();
  });
  it("binds engine capabilities to the exact workspace rather than accepting a global binding", () => {
    const scope = context();
    scope.bindings = scope.bindings.map((binding) => ({
      ...binding,
      workspaceId: "50000000-0000-4000-8000-000000000002",
    }));
    expect(
      assessPlanRequirements(
        generic.mission,
        generic.workflow,
        referencePluginContracts,
        scope,
      ).issues.map((issue) => issue.code),
    ).toContain("ENGINE_NOT_BOUND_TO_WORKSPACE");
  });
  it("rejects a mixed audit lineage or changed result version, while generic missions need no audit", () => {
    const example = referenceWorkflows.auditToHermes;
    const graph = clone(example.workflow);
    const node = graph.nodes.find((item) => item.kind === "input")!;
    if (node.kind === "input" && node.value.type === "audit-ref")
      node.value.companyId = "20000000-0000-4000-8000-000000000002";
    const scope = context();
    scope.authorizedAudits.push({
      ...scope.authorizedAudits[0],
      companyId: "20000000-0000-4000-8000-000000000002",
      auditId: "30000000-0000-4000-8000-000000000002",
    });
    expect(
      assessPlanRequirements(example.mission, graph, referencePluginContracts, scope).issues.map(
        (issue) => issue.code,
      ),
    ).toContain("AUDIT_REFERENCE_NOT_AUTHORIZED");
    scope.authorizedAudits = [];
    expect(
      assessPlanRequirements(generic.mission, generic.workflow, referencePluginContracts, scope)
        .status,
    ).toBe("requirements-satisfied");
    const changed = clone(example.workflow);
    const changedInput = changed.nodes.find((item) => item.kind === "input")!;
    if (changedInput.kind === "input" && changedInput.value.type === "audit-ref")
      changedInput.value.resultVersion = 2;
    expect(
      assessPlanRequirements(
        example.mission,
        changed,
        referencePluginContracts,
        context(),
      ).issues.map((issue) => issue.code),
    ).toContain("AUDIT_REFERENCE_NOT_AUTHORIZED");
  });
  it("requires the exact authorized n8n connection and preserves opaque native identifiers", () => {
    const example = referenceWorkflows.n8nWorkflow;
    const scope = context();
    scope.authorizedWorkflows = [];
    expect(
      assessPlanRequirements(
        example.mission,
        example.workflow,
        referencePluginContracts,
        scope,
      ).issues.map((issue) => issue.code),
    ).toContain("WORKFLOW_REFERENCE_NOT_AUTHORIZED");
    const graph = clone(example.workflow);
    const node = graph.nodes.find(
      (item) => item.kind === "input" && item.value.type === "workflow-ref",
    )!;
    if (node.kind === "input" && node.value.type === "workflow-ref")
      node.value.workflowId = "Flow_ABC-42";
    scope.authorizedWorkflows = [
      { connectionRef: "40000000-0000-4000-8000-000000000001", workflowId: "Flow_ABC-42" },
    ];
    expect(
      assessPlanRequirements(example.mission, graph, referencePluginContracts, scope).status,
    ).toBe("requirements-satisfied");
    scope.authorizedWorkflows[0].workflowId = "flow_abc-42";
    expect(
      assessPlanRequirements(example.mission, graph, referencePluginContracts, scope).status,
    ).toBe("blocked");
  });
  it("requires scoped mode and a human-review approval channel for write capabilities", () => {
    const example = referenceWorkflows.n8nWorkflow;
    expect(
      assessPlanRequirements(
        { ...example.mission, policy: { ...example.mission.policy, autonomy: "prepare" } },
        example.workflow,
        referencePluginContracts,
        context(),
      ).issues.map((issue) => issue.code),
    ).toContain("SCOPED_MODE_REQUIRED");
    const graph = clone(example.workflow);
    graph.edges.find((edge) => edge.id === "approval-to-workflow")!.from = {
      nodeId: "draft-request",
      portId: "value",
    };
    expect(codes(graph)).toContain("PORT_TYPE_MISMATCH");
    const plugin = clone(referencePluginContracts.find((item) => item.id === "n8n.workflows")!);
    plugin.capabilities[0].inputs = plugin.capabilities[0].inputs.filter(
      (port) => port.type !== "approval",
    );
    expect(pluginContractSchema.safeParse(plugin).success).toBe(false);
    const forged = clone(referencePluginContracts);
    forged
      .find((item) => item.id === "hermes.text")!
      .capabilities[0].outputs.push({ id: "forged-approval", type: "approval" });
    const forgedGraph = clone(example.workflow);
    forgedGraph.nodes.push({
      id: "fake-approver",
      kind: "capability",
      pluginId: "hermes.text",
      pluginVersion: "0.1.0",
      capabilityId: "text.generate",
    });
    forgedGraph.edges.find((edge) => edge.id === "approval-to-workflow")!.from = {
      nodeId: "fake-approver",
      portId: "forged-approval",
    };
    expect(codes(forgedGraph, forged)).toContain("INVALID_APPROVAL_SOURCE");
  });
  it("does not accept arbitrary scripts, endpoints, secrets, authors, tenant grants or paid fallbacks", () => {
    for (const extra of [
      { organizationId: "forged" },
      { userId: "forged" },
      { permissionsGranted: ["agent.run"] },
      { apiKey: "secret" },
    ])
      expect(missionRequestSchema.safeParse({ ...generic.mission, ...extra }).success).toBe(false);
    for (const policy of [
      { ...generic.mission.policy, maxNewApiCostEuro: 1 },
      { ...generic.mission.policy, paidFallback: true },
      { ...generic.mission.policy, maxConcurrentSteps: 2 },
    ])
      expect(missionRequestSchema.safeParse({ ...generic.mission, policy }).success).toBe(false);
    const graph = clone(generic.workflow);
    graph.nodes[0] = {
      ...graph.nodes[0],
      endpoint: "http://127.0.0.1",
    } as unknown as WorkflowDocument["nodes"][number];
    expect(codes(graph)).toContain("INVALID_CONTRACT");
    const scripted = clone(generic.workflow);
    scripted.nodes[0] = {
      id: "arbitrary-script",
      kind: "transform",
      operation: "eval",
    } as unknown as WorkflowDocument["nodes"][number];
    expect(codes(scripted)).toContain("INVALID_CONTRACT");
    expect(
      pluginContractSchema.safeParse({
        ...referencePluginContracts[0],
        endpoint: "https://private.invalid",
        apiKey: "secret",
      }).success,
    ).toBe(false);
  });
  it("rejects a different workflow/revision and never silently uses a newer definition", () => {
    const mission = { ...generic.mission, workflow: { ...generic.mission.workflow, revision: 2 } };
    expect(
      assessPlanRequirements(
        mission,
        generic.workflow,
        referencePluginContracts,
        context(),
      ).issues.map((issue) => issue.code),
    ).toContain("WORKFLOW_REVISION_MISMATCH");
    expect(() =>
      canonicalPlanDefinition(mission, generic.workflow, referencePluginContracts),
    ).toThrow();
  });
  it("does not mutate frozen definitions or their capability catalog during validation", () => {
    const snapshot = JSON.stringify(referenceWorkflows);
    const catalog = JSON.stringify(referencePluginContracts);
    for (const example of Object.values(referenceWorkflows)) {
      validateWorkflowDefinition(example.workflow, referencePluginContracts);
      canonicalPlanDefinition(example.mission, example.workflow, referencePluginContracts);
    }
    expect(JSON.stringify(referenceWorkflows)).toBe(snapshot);
    expect(JSON.stringify(referencePluginContracts)).toBe(catalog);
  });
});
