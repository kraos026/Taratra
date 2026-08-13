import { describe, expect, it } from "vitest";
import { E61_BASELINE, runE61Baseline } from "./e6.1-baseline";

describe("E6.1 Brain baseline", () => {
  it("executes all baseline and adversarial scenarios", () => {
    expect(E61_BASELINE.normalScenarioIds).toHaveLength(12);
    expect(E61_BASELINE.adversarialScenarioIds).toHaveLength(4);
    expect(E61_BASELINE.suite.runs).toHaveLength(16);
  });
  it("reports every dimension with raw metrics and sample count", () => {
    for (const metric of Object.values(E61_BASELINE.dimensionScorecard)) {
      expect(metric.sampleCount).toBe(16);
      expect(metric.rawMetrics).toBeDefined();
    }
  });
  it("is reproducible", () => {
    expect(runE61Baseline()).toEqual(runE61Baseline());
  });
  it("keeps adversarial scores separate", () => {
    expect(E61_BASELINE.suite.adversarialOverallScore).toBeDefined();
    expect(E61_BASELINE.suite.normalOverallScore).toBeDefined();
  });
});
