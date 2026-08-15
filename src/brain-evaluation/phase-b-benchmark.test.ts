import { describe, expect, it } from "vitest";
import {
  InMemoryPhaseBCheckpointStore,
  ResumablePhaseBBenchmark,
  createPhaseBManifest,
  summarizePhaseBTelemetry,
  type PhaseBManifest,
} from "./phase-b-benchmark";

const manifest = (size: number): PhaseBManifest => {
  const base = createPhaseBManifest("test", "dataset");
  return Object.freeze({ ...base, entries: Object.freeze(base.entries.slice(0, size)) });
};

const success = (latencyMs = 10) => ({
  status: "COMPLETED" as const,
  latencyMs,
  initialProviderCalls: 1,
  e3Entered: true,
  extractionStatus: "SUCCESS" as const,
  groundingStatus: "SUCCESS" as const,
  unknownPreservation: true,
  contradictionPreservation: true,
});

describe("E5.2M resumable Phase B harness", () => {
  it("freezes a deterministic 20-scenario, two-variant manifest", () => {
    const first = createPhaseBManifest();
    const second = createPhaseBManifest();
    expect(first.manifestHash).toBe(second.manifestHash);
    expect(first.entries).toHaveLength(40);
    expect(first.entries.filter((e) => e.scenarioGroup === "CORE")).toHaveLength(8);
    expect(first.entries.filter((e) => e.scenarioGroup === "GENERALIZATION")).toHaveLength(16);
    expect(first.entries.filter((e) => e.scenarioGroup === "HOLDOUT")).toHaveLength(16);
  });

  it("checkpoints after each run and resumes without duplicating completed runs", async () => {
    const store = new InMemoryPhaseBCheckpointStore();
    let calls = 0;
    const options = {
      benchmarkRunId: "micro",
      manifest: manifest(10),
      store,
      provider: "fake",
      model: "fake",
      maxWallClockMs: 1000,
      estimatedRunMs: 0,
      maxLogicalRunsPerBatch: 4,
      execute: async () => {
        calls += 1;
        return success();
      },
    };
    const first = await new ResumablePhaseBBenchmark(options).runBatch();
    expect(first.completedLogicalRuns).toBe(4);
    expect(first.pendingLogicalRuns).toBe(6);
    const resumed = await new ResumablePhaseBBenchmark({
      ...options,
      maxWallClockMs: 1000,
      maxLogicalRunsPerBatch: 10,
    }).runBatch();
    expect(resumed.completedLogicalRuns).toBe(10);
    expect(calls).toBe(10);
    expect(new Set(resumed.records.map((record) => record.runId)).size).toBe(10);
  });

  it("keeps final failures final and retries explicitly retryable runs", async () => {
    const store = new InMemoryPhaseBCheckpointStore();
    let calls = 0;
    const base = manifest(2);
    const runner = new ResumablePhaseBBenchmark({
      benchmarkRunId: "failures",
      manifest: base,
      store,
      provider: "fake",
      model: "fake",
      execute: async (entry) => {
        calls += 1;
        return entry.variantId === "A"
          ? {
              status: "FAILED_FINAL" as const,
              failureClass: "PERSPECTIVE_FAILURE" as const,
              latencyMs: 4,
            }
          : {
              status: "FAILED_RETRYABLE" as const,
              failureClass: "PROVIDER_FAILURE" as const,
              latencyMs: 4,
            };
      },
    });
    await runner.runBatch();
    const resumed = await new ResumablePhaseBBenchmark({
      benchmarkRunId: "failures",
      manifest: base,
      store,
      provider: "fake",
      model: "fake",
      execute: async () => {
        calls += 1;
        return success();
      },
    }).runBatch();
    expect(calls).toBe(3);
    expect(resumed.records.find((record) => record.variantId === "A")?.status).toBe("FAILED_FINAL");
    expect(resumed.records.find((record) => record.variantId === "B")?.status).toBe("COMPLETED");
  });

  it("stops and checkpoints on a safety signal", async () => {
    const store = new InMemoryPhaseBCheckpointStore();
    const report = await new ResumablePhaseBBenchmark({
      benchmarkRunId: "safety",
      manifest: manifest(3),
      store,
      provider: "fake",
      model: "fake",
      execute: async () => ({ ...success(), groundTruthLeaks: 1 }),
    }).runBatch();
    expect(report.stoppedReason).toBe("SAFETY_STOP");
    expect(report.completedLogicalRuns).toBe(1);
    expect(report.telemetry.groundTruthLeaks).toBe(1);
  });

  it("reconciles transport calls and derives incremental latency and tokens", () => {
    const telemetry = summarizePhaseBTelemetry([
      {
        runId: "1",
        benchmarkVersion: "v",
        datasetVersion: "d",
        scenarioId: "s",
        scenarioGroup: "CORE",
        variantId: "A",
        attemptNumber: 1,
        provider: "p",
        model: "m",
        startedAt: "",
        completedAt: "",
        latencyMs: 10,
        status: "COMPLETED",
        initialProviderCalls: 1,
        semanticRegenerationCalls: 1,
        httpRetryCalls: 1,
        transportCalls: 3,
        rateLimitCount: 1,
        rateLimitRecovered: 1,
        groundTruthLeaks: 0,
        unauthorizedFacts: 0,
        highRiskUnauthorizedFacts: 0,
        inventedMetrics: 0,
        inventedSystems: 0,
        inventedPolicies: 0,
        outOfScopeAssertions: 0,
        e3Entered: true,
        inputTokens: 4,
        outputTokens: 2,
      },
      {
        runId: "2",
        benchmarkVersion: "v",
        datasetVersion: "d",
        scenarioId: "s",
        scenarioGroup: "CORE",
        variantId: "B",
        attemptNumber: 1,
        provider: "p",
        model: "m",
        startedAt: "",
        completedAt: "",
        latencyMs: 20,
        status: "COMPLETED",
        initialProviderCalls: 1,
        semanticRegenerationCalls: 0,
        httpRetryCalls: 0,
        transportCalls: 1,
        rateLimitCount: 0,
        rateLimitRecovered: 0,
        groundTruthLeaks: 0,
        unauthorizedFacts: 0,
        highRiskUnauthorizedFacts: 0,
        inventedMetrics: 0,
        inventedSystems: 0,
        inventedPolicies: 0,
        outOfScopeAssertions: 0,
        e3Entered: true,
        inputTokens: 3,
        outputTokens: 1,
      },
    ]);
    expect(telemetry.totalTransportCalls).toBe(4);
    expect(telemetry.p95LatencyMs).toBe(20);
    expect(telemetry.inputTokens).toBe(7);
    expect(telemetry.outputTokens).toBe(3);
  });

  it("persists heartbeat and stage timings before the logical run completes", async () => {
    const store = new InMemoryPhaseBCheckpointStore();
    const report = await new ResumablePhaseBBenchmark({
      benchmarkRunId: "heartbeat",
      manifest: manifest(1),
      store,
      provider: "fake",
      model: "fake",
      execute: async (_entry, _attempt, context) => {
        await context.markStage("PROVIDER_REQUEST_START");
        await context.completeStage("PROVIDER_REQUEST_START");
        await context.markStage("E3_START");
        await context.completeStage("E3_START");
        return { ...success(), stageTimings: context.timings };
      },
    }).runBatch();
    const checkpoint = await store.load("heartbeat");
    expect(checkpoint?.heartbeat?.lastStageCompleted).toBe("E3_START");
    expect(report.records[0]?.stageTimings?.map((timing) => timing.stage)).toEqual([
      "PROVIDER_REQUEST_START",
      "E3_START",
    ]);
  });

  it("persists provider attempt accounting and preserves unknown token usage", async () => {
    const store = new InMemoryPhaseBCheckpointStore();
    const report = await new ResumablePhaseBBenchmark({
      benchmarkRunId: "accounting",
      manifest: manifest(1),
      store,
      provider: "fake",
      model: "fake",
      execute: async () => ({
        ...success(),
        providerAttempts: 3,
        successfulProviderAttempts: 1,
        failedProviderAttempts: 2,
        rateLimitAttempts: 1,
        timeoutAttempts: 1,
      }),
    }).runBatch();
    expect(report.records[0]?.providerAttempts).toBe(3);
    expect(report.telemetry.providerAttempts).toBe(3);
    expect(report.telemetry.successfulProviderAttempts).toBe(1);
    expect(report.telemetry.failedProviderAttempts).toBe(2);
    expect(report.telemetry.rateLimitAttempts).toBe(1);
    expect(report.telemetry.timeoutAttempts).toBe(1);
    expect(report.telemetry.inputTokens).toBeUndefined();
    expect(report.telemetry.telemetryVersion).toBe("CURRENT");
  });

  it("rejects resume when the frozen manifest changes", async () => {
    const store = new InMemoryPhaseBCheckpointStore();
    const first = manifest(1);
    await new ResumablePhaseBBenchmark({
      benchmarkRunId: "manifest-lock",
      manifest: first,
      store,
      provider: "fake",
      model: "fake",
      execute: async () => success(),
    }).runBatch();
    await expect(
      new ResumablePhaseBBenchmark({
        benchmarkRunId: "manifest-lock",
        manifest: { ...first, manifestHash: "changed" },
        store,
        provider: "fake",
        model: "fake",
        execute: async () => success(),
      }).runBatch(),
    ).rejects.toThrow("manifest mismatch");
  });
});
