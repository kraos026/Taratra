import { describe, expect, it } from "vitest";
import { GeneralizationBenchmarkRunner } from "./generalization-benchmark";

describe("E6.2 generalization benchmark", () => {
  it("keeps CORE, GENERALIZATION and HOLDOUT separated", async () => {
    const report = await new GeneralizationBenchmarkRunner().run();
    expect(report.manifest.filter((entry) => entry.group === "CORE")).toHaveLength(16);
    expect(report.manifest.filter((entry) => entry.group === "GENERALIZATION")).toHaveLength(34);
    expect(report.manifest.filter((entry) => entry.group === "HOLDOUT")).toHaveLength(16);
    expect(report.holdoutIntegrity).toBe(true);
  }, 120_000);

  it("reports realism and actionability metrics without tuning Brain", async () => {
    const report = await new GeneralizationBenchmarkRunner().run();
    expect(report.interpretationQuality.groundingSuccess).toBe(100);
    expect(report.liveSyntheticAIReadiness).toBe("DETERMINISTIC_PROVIDER_ONLY");
    expect(report.nextPriorities).toHaveLength(3);
    expect(report.dimensions.ROOT_CAUSE_ACCURACY).toBeDefined();
  }, 120_000);
});
