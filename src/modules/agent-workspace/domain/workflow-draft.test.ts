import { describe, expect, it } from "vitest";
import {
  createWorkflowDraft,
  editWorkflow,
  parseWorkflowDraft,
  removeDraftNode,
  serializeWorkflowDraft,
} from "./workflow-draft";
import { referenceWorkflows, referencePluginContracts } from "./reference-workflows";
import { canonicalPlanDefinition, validateWorkflowDefinition } from "./workflow-validation";
const ids = [
  "10000000-0000-4000-8000-000000000010",
  "60000000-0000-4000-8000-000000000010",
] as const;
describe("workflow draft lifecycle", () => {
  it("initializes all three entry modes with compatible ports and no implicit authority", () => {
    for (const mode of ["chat", "template", "canvas"] as const) {
      const draft = createWorkflowDraft(
        "generalHermes",
        ...ids,
        mode,
        "Préparer une procédure d’accueil client.",
      );
      expect(validateWorkflowDefinition(draft.workflow, referencePluginContracts).ok).toBe(true);
      expect(draft.workflow.presentation.entryMode).toBe(mode);
      expect(draft.mission.policy.autonomy).toBeNull();
      if (mode === "canvas")
        expect(draft.workflow.nodes.some((node) => node.kind === "capability")).toBe(false);
    }
    expect(() => createWorkflowDraft("generalHermes", ...ids, "chat", "court")).toThrow();
  });
  it("starts recipes with fresh identities, no inherited autonomy and no mutation of reference data", () => {
    const before = JSON.stringify(referenceWorkflows);
    for (const key of Object.keys(referenceWorkflows) as (keyof typeof referenceWorkflows)[]) {
      const draft = createWorkflowDraft(key, ...ids);
      expect(draft.workflow.id).toBe(ids[0]);
      expect(draft.mission.id).toBe(ids[1]);
      expect(draft.mission.policy.autonomy).toBeNull();
      expect(validateWorkflowDefinition(draft.workflow, referencePluginContracts).ok).toBe(true);
    }
    expect(JSON.stringify(referenceWorkflows)).toBe(before);
  });
  it("round-trips every recipe and retains advanced configuration", () => {
    for (const key of Object.keys(referenceWorkflows) as (keyof typeof referenceWorkflows)[]) {
      const draft = createWorkflowDraft(key, ...ids);
      draft.workflow.presentation.view = "advanced";
      const restored = parseWorkflowDraft(serializeWorkflowDraft(draft));
      expect(restored).toEqual(draft);
      restored.workflow.presentation.view = "simple";
      expect(
        canonicalPlanDefinition(restored.mission, restored.workflow, referencePluginContracts),
      ).toBe(canonicalPlanDefinition(draft.mission, draft.workflow, referencePluginContracts));
    }
  });
  it("revises the same mission reference and removes incident edges and positions with a node", () => {
    const draft = createWorkflowDraft("generalHermes", ...ids);
    const id = draft.workflow.nodes[1].id;
    const edited = removeDraftNode(draft, id);
    expect(edited.mission.workflow).toEqual({ id: ids[0], revision: 2 });
    expect(edited.workflow.nodes.some((n) => n.id === id)).toBe(false);
    expect(edited.workflow.edges.some((e) => e.from.nodeId === id || e.to.nodeId === id)).toBe(
      false,
    );
    expect(edited.workflow.presentation.positions.some((p) => p.nodeId === id)).toBe(false);
    expect(() => serializeWorkflowDraft(edited)).toThrow();
    expect(draft.workflow.revision).toBe(1);
  });
  it("rejects malformed, oversized, privileged, incompatible or incoherent imports", () => {
    expect(() => parseWorkflowDraft("{")).toThrow();
    expect(() => parseWorkflowDraft("é".repeat(66000))).toThrow("128 Kio");
    const draft = createWorkflowDraft("generalHermes", ...ids);
    for (const extra of [
      { serverContext: { canWrite: true } },
      { endpoint: "https://unsafe.invalid" },
      { apiKey: "secret" },
    ])
      expect(() => parseWorkflowDraft(JSON.stringify({ ...draft, ...extra }))).toThrow();
    draft.mission.workflow.revision = 8;
    expect(() => parseWorkflowDraft(JSON.stringify(draft))).toThrow("révision");
    draft.mission.workflow.revision = 1;
    draft.workflow.nodes[1] = {
      ...draft.workflow.nodes[1],
      pluginVersion: "99.0.0",
    } as (typeof draft.workflow.nodes)[number];
    expect(() => parseWorkflowDraft(JSON.stringify(draft))).toThrow();
  });
  it("refuses revision overflow instead of silently clamping the mission version", () => {
    const draft = createWorkflowDraft("generalHermes", ...ids);
    draft.workflow.revision = 1000000;
    expect(() => editWorkflow(draft, draft.workflow)).toThrow("révision");
  });
});
