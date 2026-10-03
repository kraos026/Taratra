import { describe, expect, it } from "vitest";
import { roiTraces } from "./roi-trace";

const fixture = () => ({
  evaluations: [
    { id: "a", scenarioId: "expected" },
    { id: "b", scenarioId: "expected" },
    { id: "c", scenarioId: "optimistic" },
  ],
  contributions: [
    {
      evaluationId: "a",
      scenarioId: "expected",
      assumptionId: "hourly",
      code: "hourly_cost",
      inputValue: "30",
    },
  ],
  assumptions: [
    {
      scenarioId: "expected",
      assumptionId: "hourly",
      value: "30",
      unit: "currency/hour",
      source: "provided",
    },
  ],
  evidence: [
    { evaluationId: "a", scenarioId: "expected", knowledgeFactId: "fact" },
    { evaluationId: "a", scenarioId: "expected", knowledgeFactId: "fact" },
    { evaluationId: "b", scenarioId: "expected", knowledgeFactId: "other" },
    { evaluationId: "a", scenarioId: "optimistic", knowledgeFactId: "wrong-scenario" },
  ],
});

describe("ROI render-only trace", () => {
  it("scopes and deduplicates references; serializes frozen numeric inputs without altering data", () => {
    const input = fixture();
    const before = JSON.stringify(input);
    expect(roiTraces(input)[0]).toEqual({
      evaluationId: "a",
      sharedEvaluationCount: 2,
      sourceReferenceCount: 1,
      assumptions: [{ code: "hourly_cost", value: 30, unit: "currency/hour", source: "provided" }],
    });
    expect(roiTraces(input)[1]!.assumptions).toEqual([]);
    expect(JSON.stringify(input)).toBe(before);
    expect(JSON.parse(JSON.stringify(roiTraces(input)))).toEqual(roiTraces(input));
  });
  it("does not borrow a source from a different scenario or mismatched frozen value", () => {
    const input = fixture();
    input.assumptions[0]!.scenarioId = "optimistic";
    expect(roiTraces(input)[0]!.assumptions[0]!.source).toBe("unknown");
    input.assumptions[0]!.scenarioId = "expected";
    input.assumptions[0]!.value = "99";
    expect(roiTraces(input)[0]!.assumptions[0]!.source).toBe("unknown");
  });
  it("keeps non-finite inputs unavailable and zero as zero", () => {
    const input = fixture();
    input.contributions[0]!.inputValue = "Infinity";
    expect(roiTraces(input)[0]!.assumptions[0]!.value).toBeNull();
    input.contributions[0]!.inputValue = "0";
    input.assumptions[0]!.value = "0";
    expect(roiTraces(input)[0]!.assumptions[0]!.value).toBe(0);
  });
});
