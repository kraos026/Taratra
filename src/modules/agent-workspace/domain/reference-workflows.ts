import {
  pluginContractSchema,
  missionRequestSchema,
  workflowDocumentSchema,
  type WorkflowNode,
  type WorkflowDocument,
} from "./orchestration-contracts";

/** Definition fixtures only: no packages installed and no real customer identifiers. */
export const referencePluginContracts = [
  {
    contractVersion: 1,
    id: "optivos.audit",
    version: "0.1.0",
    title: "Audit Optivos",
    kind: "business",
    capabilities: [
      {
        id: "audit.results.read",
        effect: "read",
        engine: { id: "optivos-audit", capability: "audit.results.read" },
        inputs: [{ id: "audit", type: "audit-ref" }],
        outputs: [{ id: "result", type: "artifact" }],
        permissionsRequested: ["audit.read"],
      },
    ],
  },
  {
    contractVersion: 1,
    id: "hermes.text",
    version: "0.1.0",
    title: "Mission textuelle Hermes",
    kind: "agent",
    capabilities: [
      {
        id: "text.generate",
        effect: "draft",
        engine: { id: "hermes", capability: "text.generate" },
        inputs: [{ id: "prompt", type: "text" }],
        outputs: [{ id: "result", type: "artifact" }],
        permissionsRequested: ["agent.run"],
      },
    ],
  },
  {
    contractVersion: 1,
    id: "n8n.workflows",
    version: "0.1.0",
    title: "Workflows n8n",
    kind: "workflow",
    capabilities: [
      {
        id: "workflow.run",
        effect: "write",
        engine: { id: "n8n", capability: "workflow.run" },
        inputs: [
          { id: "target", type: "workflow-ref" },
          { id: "request", type: "text" },
          { id: "approval", type: "approval" },
        ],
        outputs: [{ id: "result", type: "artifact" }],
        permissionsRequested: ["workflow.run"],
      },
    ],
  },
  {
    contractVersion: 1,
    id: "paperclip.teams",
    version: "0.1.0",
    title: "Équipes Paperclip",
    kind: "team",
    capabilities: [
      {
        id: "team.coordinate",
        effect: "write",
        engine: { id: "paperclip", capability: "team.coordinate" },
        inputs: [
          { id: "brief", type: "team-brief" },
          { id: "approval", type: "approval" },
        ],
        outputs: [{ id: "result", type: "artifact" }],
        permissionsRequested: ["team.manage"],
      },
    ],
  },
].map((plugin) => pluginContractSchema.parse(plugin));

const capability = (id: string, pluginId: string, capabilityId: string): WorkflowNode => ({
  id,
  kind: "capability",
  pluginId,
  pluginVersion: "0.1.0",
  capabilityId,
});
const review = (id: string, label: string): WorkflowNode => ({ id, kind: "human-review", label });
const output: WorkflowNode = {
  id: "deliverable",
  kind: "deliverable",
  label: "Livrable de la mission",
};
const edge = (
  id: string,
  from: string,
  portFrom: string,
  to: string,
  portTo: string,
): WorkflowDocument["edges"][number] => ({
  id,
  from: { nodeId: from, portId: portFrom },
  to: { nodeId: to, portId: portTo },
});
function example(
  number: number,
  title: string,
  objective: string,
  nodes: WorkflowNode[],
  edges: WorkflowDocument["edges"],
  autonomy: "prepare" | "scoped",
) {
  const workflow = workflowDocumentSchema.parse({
    contractVersion: 1,
    id: `10000000-0000-4000-8000-00000000000${number}`,
    revision: 1,
    title,
    nodes,
    edges,
    presentation: {
      entryMode: number === 1 ? "template" : number === 2 ? "chat" : "canvas",
      view: "simple",
      positions: nodes.map((node, index) => ({ nodeId: node.id, x: index * 240, y: 0 })),
    },
  });
  const mission = missionRequestSchema.parse({
    contractVersion: 1,
    id: `60000000-0000-4000-8000-00000000000${number}`,
    objective,
    workflow: { id: workflow.id, revision: workflow.revision },
    policy: { autonomy, maxNewApiCostEuro: 0, paidFallback: false, maxConcurrentSteps: 1 },
  });
  return { status: "definition-only" as const, mission, workflow };
}

export const referenceWorkflows = {
  auditToHermes: example(
    1,
    "Expliquer un audit existant",
    "Préparer un plan de suite à partir d’un résultat d’audit publié, puis le faire relire.",
    [
      {
        id: "audit-source",
        kind: "input",
        value: {
          type: "audit-ref",
          companyId: "20000000-0000-4000-8000-000000000001",
          auditId: "30000000-0000-4000-8000-000000000001",
          resultVersion: 1,
        },
      },
      capability("read-audit", "optivos.audit", "audit.results.read"),
      { id: "extract-summary", kind: "transform", operation: "extract-text" },
      capability("draft-plan", "hermes.text", "text.generate"),
      review("review-result", "Relire le plan proposé"),
      output,
    ],
    [
      edge("audit-to-reader", "audit-source", "value", "read-audit", "audit"),
      edge("reader-to-text", "read-audit", "result", "extract-summary", "value"),
      edge("text-to-agent", "extract-summary", "value", "draft-plan", "prompt"),
      edge("draft-to-review", "draft-plan", "result", "review-result", "content"),
      edge("review-to-result", "review-result", "content", "deliverable", "content"),
    ],
    "prepare",
  ),
  generalHermes: example(
    2,
    "Mission Hermes générale",
    "Rédiger une procédure d’accueil client et faire valider le livrable sans audit préalable.",
    [
      {
        id: "request",
        kind: "input",
        value: {
          type: "text",
          text: "Prépare une procédure d’accueil client en cinq étapes avec les responsabilités à confirmer.",
        },
      },
      capability("draft-text", "hermes.text", "text.generate"),
      review("review-result", "Relire et valider le document"),
      output,
    ],
    [
      edge("request-to-agent", "request", "value", "draft-text", "prompt"),
      edge("draft-to-review", "draft-text", "result", "review-result", "content"),
      edge("review-to-result", "review-result", "content", "deliverable", "content"),
    ],
    "prepare",
  ),
  n8nWorkflow: example(
    3,
    "Workflow n8n autorisé",
    "Lancer un workflow interne préalablement autorisé depuis le canevas et consulter son résultat.",
    [
      {
        id: "workflow-target",
        kind: "input",
        value: {
          type: "workflow-ref",
          connectionRef: "40000000-0000-4000-8000-000000000001",
          workflowId: "pilot-internal-brief",
        },
      },
      {
        id: "request",
        kind: "input",
        value: {
          type: "text",
          text: "Produire un document interne de recette, sans envoi à un tiers.",
        },
      },
      { id: "draft-request", kind: "transform", operation: "draft-text" },
      review("approve-request", "Autoriser cette exécution de workflow"),
      capability("run-workflow", "n8n.workflows", "workflow.run"),
      review("review-result", "Vérifier le résultat du workflow"),
      output,
    ],
    [
      edge("request-to-draft", "request", "value", "draft-request", "value"),
      edge("draft-to-approval", "draft-request", "value", "approve-request", "content"),
      edge("approval-to-workflow", "approve-request", "approval", "run-workflow", "approval"),
      edge("target-to-workflow", "workflow-target", "value", "run-workflow", "target"),
      edge("request-to-workflow", "request", "value", "run-workflow", "request"),
      edge("workflow-to-review", "run-workflow", "result", "review-result", "content"),
      edge("review-to-result", "review-result", "content", "deliverable", "content"),
    ],
    "scoped",
  ),
  paperclipTeam: example(
    4,
    "Équipe Paperclip avec objectif",
    "Préparer puis autoriser une petite équipe d’agents sur un objectif interne et suivre son livrable.",
    [
      {
        id: "team-brief",
        kind: "input",
        value: {
          type: "team-brief",
          objective:
            "Préparer un guide interne d’accueil client et documenter les questions ouvertes.",
          agents: [
            { name: "Coordinateur", role: "Organiser le travail et les validations" },
            { name: "Rédacteur", role: "Préparer le guide pour relecture" },
          ],
        },
      },
      { id: "draft-brief", kind: "transform", operation: "draft-team" },
      review("approve-team", "Autoriser l’équipe et cet objectif"),
      capability("coordinate-team", "paperclip.teams", "team.coordinate"),
      review("review-result", "Relire le livrable de l’équipe"),
      output,
    ],
    [
      edge("brief-to-draft", "team-brief", "value", "draft-brief", "value"),
      edge("draft-to-approval", "draft-brief", "value", "approve-team", "content"),
      edge("approval-to-team", "approve-team", "approval", "coordinate-team", "approval"),
      edge("brief-to-team", "team-brief", "value", "coordinate-team", "brief"),
      edge("team-to-review", "coordinate-team", "result", "review-result", "content"),
      edge("review-to-result", "review-result", "content", "deliverable", "content"),
    ],
    "scoped",
  ),
};
