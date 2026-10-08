import { describe, expect, it } from "vitest";
import { groupRoiEvaluations } from "./roi-evaluation-groups";
import type { RoiTrace } from "./roi-trace";

function fixture() {
  const evaluations = ["invoice", "email", "sheet"].map((id) => ({
    id,
    scenarioId: "expected",
    confidence: 100,
  }));
  const metrics = evaluations.map(({ id }) => ({
    evaluationId: id,
    code: "annual_benefit",
    value: 4320,
    specialValue: null,
    unit: "currency/year",
  }));
  const traces: RoiTrace[] = evaluations.map(({ id }, index) => ({
    evaluationId: id,
    sharedEvaluationCount: 3,
    sourceReferenceCount: index + 1,
    volumeFactor: 1,
    costFactor: 1,
    assumptions: [
      { code: "annual_frequency", value: 1440, unit: "occurrences/year", source: "provided" },
    ],
  }));
  return { evaluations, metrics, traces };
}
describe("shared ROI presentation groups", () => {
  it("groups identical scenario calculations without changing inputs or losing source identities", () => {
    const input = fixture();
    const before = JSON.stringify(input);
    const groups = groupRoiEvaluations(input.evaluations, input.metrics, input.traces);
    expect(groups.map((group) => group.map((row) => row.id))).toEqual([
      ["invoice", "email", "sheet"],
    ]);
    expect(JSON.stringify(input)).toBe(before);
  });
  it.each(["scenario", "metric", "assumption", "source", "factor", "confidence"])(
    "does not merge a different %s",
    (field) => {
      const input = fixture();
      if (field === "scenario") input.evaluations[1]!.scenarioId = "optimistic";
      if (field === "metric") input.metrics[1]!.value = 8000;
      if (field === "assumption") input.traces[1]!.assumptions[0]!.value = 800;
      if (field === "source") input.traces[1]!.assumptions[0]!.source = "catalog_default";
      if (field === "factor") input.traces[1]!.volumeFactor = 0.5;
      if (field === "confidence") input.evaluations[1]!.confidence = 50;
      expect(
        groupRoiEvaluations(input.evaluations, input.metrics, input.traces).map((g) =>
          g.map((e) => e.id),
        ),
      ).toEqual([["invoice", "sheet"], ["email"]]);
    },
  );
  it("does not infer shared assumptions from identical amounts without traces", () => {
    const input = fixture();
    expect(groupRoiEvaluations(input.evaluations, input.metrics, []).map((g) => g.length)).toEqual([
      1, 1, 1,
    ]);
  });
  it.each(["unknown", "null", "missing", "special"])("keeps %s data separate", (field) => {
    const input = fixture();
    if (field === "unknown") input.traces.forEach((t) => (t.assumptions[0]!.source = "unknown"));
    if (field === "null") input.traces.forEach((t) => (t.assumptions[0]!.value = null));
    if (field === "missing") input.metrics.length = 0;
    if (field === "special")
      input.metrics.forEach((m) =>
        Object.assign(m, { specialValue: "INSUFFICIENT_EVIDENCE", value: null }),
      );
    expect(
      groupRoiEvaluations(input.evaluations, input.metrics, input.traces).map((g) => g.length),
    ).toEqual([1, 1, 1]);
  });
});
