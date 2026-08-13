import { describe, expect, it } from "vitest";
import { createGlobalKnowledgePackV2 } from "./knowledge-library-v2";
import {
  DeterministicKnowledgeRetrievalEngine,
  type KnowledgeRetrievalQuery,
} from "./knowledge-retrieval-engine";

const query = (
  intent: KnowledgeRetrievalQuery["retrievalIntent"],
  extra: Partial<KnowledgeRetrievalQuery> = {},
): KnowledgeRetrievalQuery => ({
  retrievalIntent: intent,
  scope: "GLOBAL",
  signals: ["manual", "data", "reentry"],
  ...extra,
});
const budget = {
  maxItems: 8,
  maxItemsPerType: 3,
  maxPatterns: 3,
  maxSolutions: 2,
  maxRisks: 2,
  maxControls: 2,
  maxRelationshipDepth: 2,
  minimumScore: 0,
};

describe("Knowledge retrieval engine", () => {
  it("returns deterministic rankings", () => {
    const { library } = createGlobalKnowledgePackV2();
    const e = new DeterministicKnowledgeRetrievalEngine();
    expect(
      e.retrieve(library, query("SUPPORT_OPPORTUNITY"), budget).map((r) => r.knowledgeId),
    ).toEqual(e.retrieve(library, query("SUPPORT_OPPORTUNITY"), budget).map((r) => r.knowledgeId));
  });
  it("keeps context bounded and diverse", () => {
    const { library } = createGlobalKnowledgePackV2();
    const c = new DeterministicKnowledgeRetrievalEngine().buildContext(
      library,
      query("SUPPORT_OPPORTUNITY"),
      budget,
    );
    expect(c.selectedPatterns.length).toBeLessThanOrEqual(3);
    expect(c.selectedSolutions.length).toBeLessThanOrEqual(2);
  });
  it("includes whySelected for every item", () => {
    const { library } = createGlobalKnowledgePackV2();
    const r = new DeterministicKnowledgeRetrievalEngine().retrieve(
      library,
      query("FIND_CAUSES"),
      budget,
    );
    expect(r.every((x) => x.whySelected.length > 0)).toBe(true);
  });
  it("prioritizes causes for FIND_CAUSES", () => {
    const { library } = createGlobalKnowledgePackV2();
    const r = new DeterministicKnowledgeRetrievalEngine().retrieve(
      library,
      query("FIND_CAUSES", { signals: ["master", "data"] }),
      budget,
    );
    expect(r[0]?.item.item.kind).toBe("ROOT_CAUSE_PATTERN");
  });
  it("prioritizes solutions for FIND_SOLUTIONS", () => {
    const { library } = createGlobalKnowledgePackV2();
    const r = new DeterministicKnowledgeRetrievalEngine().retrieve(
      library,
      query("FIND_SOLUTIONS", { signals: ["api", "synchronization"] }),
      budget,
    );
    expect(r.some((x) => x.item.item.kind === "SOLUTION_PATTERN")).toBe(true);
  });
  it("accounts for counter-signals", () => {
    const { library } = createGlobalKnowledgePackV2();
    const e = new DeterministicKnowledgeRetrievalEngine();
    const r = e.retrieve(library, query("FIND_RISKS", { signals: ["mandatory control"] }), budget);
    expect(r.every((x) => x.counterSignalPenalty >= 0)).toBe(true);
  });
  it("uses unknown-aware clarification intent", () => {
    const { library } = createGlobalKnowledgePackV2();
    const r = new DeterministicKnowledgeRetrievalEngine().retrieve(
      library,
      query("SUPPORT_CLARIFICATION", { unknowns: ["api availability"], signals: ["api"] }),
      budget,
    );
    expect(r.length).toBeGreaterThan(0);
  });
  it("bounds relationship traversal", () => {
    const { library } = createGlobalKnowledgePackV2();
    const r = new DeterministicKnowledgeRetrievalEngine().retrieve(
      library,
      query("SUPPORT_OPPORTUNITY", { signals: ["master", "data"] }),
      { ...budget, maxRelationshipDepth: 1 },
    );
    expect(r.every((x) => x.relationshipPath.length <= 3)).toBe(true);
  });
  it("does not produce company facts", () => {
    const { library } = createGlobalKnowledgePackV2();
    const c = new DeterministicKnowledgeRetrievalEngine().buildContext(
      library,
      query("UNDERSTAND_PROCESS"),
      budget,
    );
    expect(c).not.toHaveProperty("facts");
  });
  it("produces quality metrics", () => {
    const { library } = createGlobalKnowledgePackV2();
    const e = new DeterministicKnowledgeRetrievalEngine();
    const r = e.retrieve(library, query("FIND_SOLUTIONS"), budget);
    const m = e.metrics(r, []);
    expect(m.explanationCompleteness).toBe(1);
  });
  it("keeps economic retrieval limited to risk/control context", () => {
    const { library } = createGlobalKnowledgePackV2();
    const r = new DeterministicKnowledgeRetrievalEngine().retrieve(
      library,
      query("SUPPORT_ECONOMIC_ANALYSIS"),
      budget,
    );
    expect(
      r.every((x) =>
        ["RISK_PATTERN", "CONTROL_PATTERN", "ROOT_CAUSE_PATTERN", "SOLUTION_PATTERN"].includes(
          x.item.item.kind,
        ),
      ),
    ).toBe(true);
  });
  it("does not mutate the library", () => {
    const { library } = createGlobalKnowledgePackV2();
    const before = library.all().map((x) => x.item.id);
    new DeterministicKnowledgeRetrievalEngine().retrieve(library, query("FIND_CAUSES"), budget);
    expect(library.all().map((x) => x.item.id)).toEqual(before);
  });
});
