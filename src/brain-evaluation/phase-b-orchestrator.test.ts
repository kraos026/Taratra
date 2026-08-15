import { describe, expect, it } from "vitest";
import { InMemoryPhaseBCheckpointStore } from "./phase-b-benchmark";
import { PhaseBLiveOrchestrator } from "./phase-b-orchestrator";

describe("E6.4A persistent Phase B orchestrator", () => {
  it("completes the frozen 40-run dry run without duplicates", async () => {
    const store = new InMemoryPhaseBCheckpointStore();
    const orchestrator = new PhaseBLiveOrchestrator({
      benchmarkRunId: "e6.4a-dry-run",
      mode: "DRY_RUN",
      store,
      maxRunsPerBatch: 40,
    });
    const result = await orchestrator.runBatch();
    const report = await orchestrator.report();
    expect(result.completedLogicalRuns).toBe(40);
    expect(new Set(result.records.map((record) => record.runId)).size).toBe(40);
    expect(report.currentStatus).toBe("COMPLETE");
    expect(report.groups.CORE?.completed).toBe(8);
    expect(report.groups.GENERALIZATION?.completed).toBe(16);
    expect(report.groups.HOLDOUT?.completed).toBe(16);
    expect(report.variantPairs.every((pair) => pair.complete)).toBe(true);
  });

  it("resumes a bounded dry-run batch without replaying completed runs", async () => {
    const store = new InMemoryPhaseBCheckpointStore();
    const first = new PhaseBLiveOrchestrator({
      benchmarkRunId: "e6.4a-resume",
      mode: "DRY_RUN",
      store,
      maxRunsPerBatch: 5,
    });
    expect((await first.runBatch()).completedLogicalRuns).toBe(5);
    const second = new PhaseBLiveOrchestrator({
      benchmarkRunId: "e6.4a-resume",
      mode: "DRY_RUN",
      store,
      maxRunsPerBatch: 40,
    });
    const resumed = await second.runBatch();
    expect(resumed.completedLogicalRuns).toBe(40);
    expect(new Set(resumed.records.map((record) => record.runId)).size).toBe(40);
  });
});
