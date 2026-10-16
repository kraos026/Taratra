import { z } from "zod";
import {
  missionRequestSchema,
  workflowDocumentSchema,
  type WorkflowDocument,
  type WorkflowNode,
} from "./orchestration-contracts";
import { referencePluginContracts, referenceWorkflows } from "./reference-workflows";
import { validateWorkflowDefinition } from "./workflow-validation";

export const draftPacketSchema = z
  .object({
    status: z.literal("definition-only"),
    mission: missionRequestSchema,
    workflow: workflowDocumentSchema,
  })
  .strict();
export type WorkflowDraft = z.infer<typeof draftPacketSchema>;
export type RecipeId = keyof typeof referenceWorkflows;
export function createWorkflowDraft(
  recipe: RecipeId,
  workflowId: string,
  missionId: string,
  entryMode: "chat" | "template" | "canvas" = "template",
  prompt = "",
): WorkflowDraft {
  const draft = structuredClone(referenceWorkflows[recipe]);
  draft.workflow.id = workflowId;
  draft.workflow.revision = 1;
  draft.mission.id = missionId;
  draft.mission.workflow = { id: workflowId, revision: 1 };
  // Choosing a recipe never selects the user's effective autonomy.
  draft.mission.policy.autonomy = null;
  draft.workflow.presentation.entryMode = entryMode;
  if (entryMode !== "template" && recipe !== "generalHermes")
    throw new Error("Ce point de départ utilise le parcours textuel général.");
  if (entryMode === "chat") {
    const text = prompt.trim();
    if (text.length < 10 || text.length > 2000)
      throw new Error("La consigne doit contenir entre 10 et 2000 caractères.");
    draft.mission.objective = text;
    draft.workflow.nodes = draft.workflow.nodes.map((node) =>
      node.kind === "input" && node.value.type === "text"
        ? { ...node, value: { type: "text", text } }
        : node,
    );
  }
  if (entryMode === "canvas") {
    const replaced = new Set(
      draft.workflow.nodes.filter((node) => node.kind === "capability").map((node) => node.id),
    );
    draft.workflow.title = "Workflow manuel";
    draft.workflow.nodes = draft.workflow.nodes.map((node) =>
      replaced.has(node.id) ? { id: node.id, kind: "transform", operation: "draft-text" } : node,
    );
    draft.workflow.edges = draft.workflow.edges.map((edge) => ({
      ...edge,
      from: { ...edge.from, portId: replaced.has(edge.from.nodeId) ? "value" : edge.from.portId },
      to: { ...edge.to, portId: replaced.has(edge.to.nodeId) ? "value" : edge.to.portId },
    }));
  }
  return draft;
}
export function editWorkflow(draft: WorkflowDraft, workflow: WorkflowDocument): WorkflowDraft {
  if (draft.workflow.revision >= 1000000)
    throw new Error("Limite de révision atteinte. Exportez puis créez un nouveau brouillon.");
  const revision = draft.workflow.revision + 1;
  return {
    ...draft,
    workflow: { ...workflow, revision },
    mission: { ...draft.mission, workflow: { id: workflow.id, revision } },
  };
}
export function replaceDraftNode(draft: WorkflowDraft, node: WorkflowNode) {
  return editWorkflow(draft, {
    ...draft.workflow,
    nodes: draft.workflow.nodes.map((item) => (item.id === node.id ? node : item)),
  });
}
export function removeDraftNode(draft: WorkflowDraft, id: string) {
  return editWorkflow(draft, {
    ...draft.workflow,
    nodes: draft.workflow.nodes.filter((node) => node.id !== id),
    edges: draft.workflow.edges.filter((edge) => edge.from.nodeId !== id && edge.to.nodeId !== id),
    presentation: {
      ...draft.workflow.presentation,
      positions: draft.workflow.presentation.positions.filter((position) => position.nodeId !== id),
    },
  });
}
export function parseWorkflowDraft(text: string): WorkflowDraft {
  if (new TextEncoder().encode(text).byteLength > 131072)
    throw new Error("Le fichier dépasse 128 Kio.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Le fichier doit contenir un document JSON valide.");
  }
  const parsed = draftPacketSchema.safeParse(value);
  if (!parsed.success) throw new Error("Format de brouillon incompatible ou champs non autorisés.");
  const draft = parsed.data;
  if (
    draft.mission.workflow.id !== draft.workflow.id ||
    draft.mission.workflow.revision !== draft.workflow.revision
  )
    throw new Error("La mission ne référence pas cette révision du workflow.");
  if (!validateWorkflowDefinition(draft.workflow, referencePluginContracts).ok)
    throw new Error("La structure du workflow contient des connexions ou capacités incompatibles.");
  return draft;
}
export function serializeWorkflowDraft(draft: WorkflowDraft) {
  const text = JSON.stringify(draft, null, 2);
  parseWorkflowDraft(text);
  return text;
}
export function nodeLabel(node: WorkflowNode) {
  if (node.kind === "input")
    return {
      text: "Consigne",
      "audit-ref": "Dossier d’audit",
      "workflow-ref": "Workflow n8n",
      "team-brief": "Objectif et équipe",
    }[node.value.type];
  if (node.kind === "capability")
    return (
      {
        "optivos.audit": "Lire les résultats d’audit",
        "hermes.text": "Préparer avec Hermes",
        "n8n.workflows": "Exécuter avec n8n",
        "paperclip.teams": "Coordonner avec Paperclip",
      }[node.pluginId] || node.capabilityId
    );
  if (node.kind === "transform")
    return {
      "extract-text": "Extraire le texte",
      "draft-text": "Préparer un document",
      "draft-team": "Préparer l’équipe",
    }[node.operation];
  return node.label;
}
