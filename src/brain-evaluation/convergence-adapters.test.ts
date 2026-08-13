import { describe, expect, it } from "vitest";
import {
  ConfidenceAdapter,
  BrainIdentityMap,
  ProvenanceAdapter,
  EnterpriseEvidenceAdapter,
  ProcessMapAdapter,
  DualRunHarness,
} from "./convergence-adapters";
describe("engine/brain convergence adapters", () => {
  it("converts confidence deterministically", () => {
    expect(ConfidenceAdapter.toBrain(82)).toBe(0.82);
    expect(ConfidenceAdapter.toProduction(0.825)).toBe(83);
    expect(() => ConfidenceAdapter.toBrain(101)).toThrow();
  });
  it("keeps identity roundtrips explicit", () => {
    const map = new BrainIdentityMap();
    map.bind("process", "p1", "process:p1");
    expect(map.resolve("process", "p1")).toBe("process:p1");
    expect(() => map.resolve("claim", "p1")).toThrow();
    expect(() => map.bind("process", "p1", "other")).toThrow();
  });
  it("preserves provenance in a trace", () => {
    const trace = new ProvenanceAdapter().toTrace(
      [
        {
          sourceId: "s1",
          sourceType: "KNOWLEDGE",
          sourceVersion: 2,
          capturedAt: new Date("2026-01-01"),
        },
      ],
      "target",
    );
    expect(trace.backward("target")).toHaveLength(1);
    expect(trace.nodes["provenance:s1:0"]).toContain("v2");
  });
  it("adapts evidence and only explicit claims", () => {
    const result = new EnterpriseEvidenceAdapter().toBrain([
      {
        id: "e1",
        sourceType: "OBSERVED",
        sourceReference: "work",
        capturedAt: new Date("2026-01-01"),
        freshness: "CURRENT",
        reliability: 0.9,
        content: "fact",
        provenance: {},
        claim: { id: "claim:e1", statement: "fact", kind: "FACT" },
      },
    ]);
    expect(result.evidence).toHaveLength(1);
    expect(result.claims).toHaveLength(1);
  });
  it("projects published process maps without mutating source", () => {
    const source = {
      id: "map",
      version: 1,
      status: "published" as const,
      name: "Orders",
      nodes: [{ id: "step-1", type: "step" as const, name: "Validate", processingMinutes: 5 }],
      edges: [],
      controls: [],
    };
    const brain = new ProcessMapAdapter().toBrain(source);
    expect(brain.process.steps[0]?.stepId).toBe("step-1");
    expect(source.nodes[0]?.name).toBe("Validate");
  });
  it("keeps dual-run ownership in production", () =>
    expect(
      new DualRunHarness().compare({ status: "published" }, { decision: "RECOMMEND_CANDIDATE" })
        .ownership,
    ).toBe("PRODUCTION"));
});
