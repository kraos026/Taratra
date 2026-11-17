import { z } from "zod";

export const contractId = z.string().regex(/^[a-z0-9][a-z0-9.-]{1,63}$/);
export const exactVersion = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
  .max(32);
export const portType = z.enum([
  "text",
  "audit-ref",
  "workflow-ref",
  "team-brief",
  "artifact",
  "approval",
]);
export const permissionId = z.enum(["audit.read", "agent.run", "workflow.run", "team.manage"]);
const port = z.object({ id: contractId, type: portType }).strict();
const unique = (items: readonly { id: string }[]) =>
  new Set(items.map((item) => item.id)).size === items.length;
const ports = z.array(port).max(8).refine(unique, "Duplicate port");
export const pluginContractSchema = z
  .object({
    contractVersion: z.literal(1),
    id: contractId,
    version: exactVersion,
    title: z.string().trim().min(2).max(100),
    kind: z.enum(["business", "agent", "workflow", "team"]),
    capabilities: z
      .array(
        z
          .object({
            id: contractId,
            effect: z.enum(["read", "draft", "write"]),
            engine: z.object({ id: contractId, capability: contractId }).strict(),
            inputs: ports,
            outputs: ports,
            permissionsRequested: z
              .array(permissionId)
              .min(1)
              .max(4)
              .refine((values) => new Set(values).size === values.length),
          })
          .strict()
          .superRefine((capability, context) => {
            if (
              capability.effect === "write" &&
              !capability.inputs.some((item) => item.type === "approval")
            )
              context.addIssue({
                code: "custom",
                message: "Write capability requires an approval port",
              });
            if (!capability.outputs.length)
              context.addIssue({ code: "custom", message: "Capability needs an output" });
          }),
      )
      .min(1)
      .max(16)
      .refine(unique, "Duplicate capability"),
  })
  .strict();
export type PluginContract = z.infer<typeof pluginContractSchema>;

export const inputValueSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().trim().min(1).max(2000) }).strict(),
  z
    .object({
      type: z.literal("audit-ref"),
      companyId: z.string().uuid(),
      auditId: z.string().uuid(),
      resultVersion: z.number().int().positive().max(1000000),
    })
    .strict(),
  z
    .object({
      type: z.literal("workflow-ref"),
      connectionRef: z.string().uuid(),
      workflowId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    })
    .strict(),
  z
    .object({
      type: z.literal("team-brief"),
      objective: z.string().trim().min(10).max(2000),
      agents: z
        .array(
          z
            .object({
              name: z.string().trim().min(2).max(80),
              role: z.string().trim().min(2).max(160),
            })
            .strict(),
        )
        .min(1)
        .max(3)
        .refine(
          (agents) =>
            new Set(agents.map((agent) => agent.name.toLocaleLowerCase("fr"))).size ===
            agents.length,
          "Duplicate agent name",
        ),
    })
    .strict(),
]);
const nodeBase = { id: contractId };
export const workflowNodeSchema = z.discriminatedUnion("kind", [
  z.object({ ...nodeBase, kind: z.literal("input"), value: inputValueSchema }).strict(),
  z
    .object({
      ...nodeBase,
      kind: z.literal("capability"),
      pluginId: contractId,
      pluginVersion: exactVersion,
      capabilityId: contractId,
    })
    .strict(),
  z
    .object({
      ...nodeBase,
      kind: z.literal("transform"),
      operation: z.enum(["extract-text", "draft-text", "draft-team"]),
    })
    .strict(),
  z
    .object({
      ...nodeBase,
      kind: z.literal("human-review"),
      label: z.string().trim().min(2).max(120),
    })
    .strict(),
  z
    .object({
      ...nodeBase,
      kind: z.literal("deliverable"),
      label: z.string().trim().min(2).max(120),
    })
    .strict(),
]);
const endpoint = z.object({ nodeId: contractId, portId: contractId }).strict();
export const workflowDocumentSchema = z
  .object({
    contractVersion: z.literal(1),
    id: z.string().uuid(),
    revision: z.number().int().positive().max(1000000),
    title: z.string().trim().min(2).max(120),
    nodes: z.array(workflowNodeSchema).min(2).max(64),
    edges: z
      .array(z.object({ id: contractId, from: endpoint, to: endpoint }).strict())
      .min(1)
      .max(128),
    presentation: z
      .object({
        entryMode: z.enum(["chat", "template", "canvas"]),
        view: z.enum(["simple", "advanced"]),
        positions: z
          .array(
            z
              .object({
                nodeId: contractId,
                x: z.number().finite().min(-100000).max(100000),
                y: z.number().finite().min(-100000).max(100000),
              })
              .strict(),
          )
          .max(64),
      })
      .strict(),
  })
  .strict();
export type WorkflowDocument = z.infer<typeof workflowDocumentSchema>;
export type WorkflowNode = WorkflowDocument["nodes"][number];
export type CapabilityContract = PluginContract["capabilities"][number];

export const missionRequestSchema = z
  .object({
    contractVersion: z.literal(1),
    id: z.string().uuid(),
    objective: z.string().trim().min(10).max(2000),
    workflow: z
      .object({ id: z.string().uuid(), revision: z.number().int().positive().max(1000000) })
      .strict(),
    policy: z
      .object({
        autonomy: z.enum(["prepare", "scoped"]).nullable(),
        maxNewApiCostEuro: z.literal(0),
        paidFallback: z.literal(false),
        maxConcurrentSteps: z.literal(1),
      })
      .strict(),
  })
  .strict();
export type MissionRequest = z.infer<typeof missionRequestSchema>;

/** Only a server composition root may construct this context from verified access. */
export const planningContextSchema = z
  .object({
    workspaceId: z.string().uuid(),
    canWrite: z.boolean(),
    permissionsGranted: z.array(permissionId).max(4),
    installedPlugins: z.array(z.object({ id: contractId, version: exactVersion }).strict()).max(32),
    bindings: z
      .array(
        z
          .object({ workspaceId: z.string().uuid(), engineId: contractId, capability: contractId })
          .strict(),
      )
      .max(64),
    authorizedAudits: z
      .array(
        z
          .object({
            companyId: z.string().uuid(),
            auditId: z.string().uuid(),
            resultVersion: z.number().int().positive(),
          })
          .strict(),
      )
      .max(64),
    authorizedWorkflows: z
      .array(
        z
          .object({
            connectionRef: z.string().uuid(),
            workflowId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
          })
          .strict(),
      )
      .max(64),
  })
  .strict();
export type PlanningContext = z.infer<typeof planningContextSchema>;
