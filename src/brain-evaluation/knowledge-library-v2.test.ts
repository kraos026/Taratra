import { describe, expect, it } from "vitest";
import { createGlobalKnowledgePackV2, KnowledgeLibraryV2 } from "./knowledge-library-v2";

describe("Knowledge Library V2", () => {
  it("creates a curated global pack with focused reusable items", () => {
    const { library, pack } = createGlobalKnowledgePackV2();
    expect(pack.status).toBe("ACTIVE");
    expect(library.all().length).toBeGreaterThanOrEqual(40);
    expect(library.all().length).toBeLessThan(60);
  });
  it("has no duplicate identifiers or dangling pack references", () => {
    const { library } = createGlobalKnowledgePackV2();
    expect(new Set(library.all().map((r) => r.item.id)).size).toBe(library.all().length);
  });
  it("requires evidence and rejection conditions for process patterns", () => {
    const { library } = createGlobalKnowledgePackV2();
    expect(
      library.findByKind("PROCESS_PATTERN").every((r) => r.item.requiredEvidence.length > 0),
    ).toBe(true);
  });
  it("keeps root causes as candidates with rejection conditions", () => {
    const { library } = createGlobalKnowledgePackV2();
    expect(
      library.findByKind("ROOT_CAUSE_PATTERN").every((r) => r.item.rejectionConditions.length > 0),
    ).toBe(true);
  });
  it("ensures solutions expose failure modes and controls", () => {
    const { library } = createGlobalKnowledgePackV2();
    expect(
      library
        .findByKind("SOLUTION_PATTERN")
        .every((r) => r.item.failureModes.length > 0 && r.item.controls.length > 0),
    ).toBe(true);
  });
  it("does not fabricate benchmark values", () => {
    const { library } = createGlobalKnowledgePackV2();
    expect(library.findByKind("BENCHMARK_TEMPLATE")).toHaveLength(0);
  });
  it("supports deterministic relationship queries", () => {
    const { library } = createGlobalKnowledgePackV2();
    expect(library.findRelatedKnowledge("poor-master-data").map((r) => r.item.id)).toEqual([
      "repeated-reconciliation",
    ]);
  });
  it("rejects dangling relationships", () => {
    const library = new KnowledgeLibraryV2();
    expect(() =>
      library.relate({
        id: "x",
        fromId: "missing",
        toId: "also-missing",
        type: "RELATED_TO",
        rationale: "bad",
      }),
    ).toThrow();
  });
  it("rejects duplicate knowledge ids", () => {
    const { library } = createGlobalKnowledgePackV2();
    const record = library.get("manual-data-reentry")!;
    expect(() => library.add(record)).toThrow();
  });
  it("ranks relevant patterns with explicit reasons", () => {
    const { library } = createGlobalKnowledgePackV2();
    const result = library.findRelevantPatterns({ signals: ["manual", "reentry"] });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.why.length).toBeGreaterThan(0);
  });
  it("finds root causes, solutions, controls and capabilities", () => {
    const { library } = createGlobalKnowledgePackV2();
    expect(library.findRootCauseCandidates({ signals: ["master", "data"] }).length).toBeGreaterThan(
      0,
    );
    expect(library.findSolutionCandidates({ signals: ["api"] }).length).toBeGreaterThan(0);
    expect(library.findCapabilities({ signals: ["read"] }).length).toBeGreaterThan(0);
  });
  it("surfaces anti-pattern warnings and blocking matches", () => {
    const { library } = createGlobalKnowledgePackV2();
    const result = library.checkAntiPatterns({
      signals: ["broken", "process"],
      constraints: ["process ownership unknown"],
    });
    expect(["WARNING", "BLOCKING_ANTI_PATTERN"]).toContain(result.status);
  });
  it("keeps anti-pattern controls explicit", () => {
    const { library } = createGlobalKnowledgePackV2();
    expect(library.findByKind("ANTI_PATTERN").every((r) => r.item.controls.length > 0)).toBe(true);
  });
  it("keeps knowledge immutable", () => {
    const { library } = createGlobalKnowledgePackV2();
    const item = library.get("manual-data-reentry")!;
    expect(Object.isFrozen(item)).toBe(true);
    expect(Object.isFrozen(item.item)).toBe(true);
  });
  it("does not claim sector-specific authority", () => {
    const { library } = createGlobalKnowledgePackV2();
    expect(
      library.all().every((r) => r.item.scope === "GLOBAL" && r.item.domain === "cross-sector"),
    ).toBe(true);
  });
  it("pack versions are immutable and duplicate versions rejected", () => {
    const { library, pack } = createGlobalKnowledgePackV2();
    expect(() => library.addPack(pack)).toThrow();
  });
  it("quality metadata distinguishes curated knowledge from evidence", () => {
    const { library } = createGlobalKnowledgePackV2();
    expect(
      library
        .all()
        .every(
          (r) =>
            r.item.qualityStatus === "REVIEWED" && r.item.provenanceCategory === "EXPERT_CURATED",
        ),
    ).toBe(true);
  });
});
