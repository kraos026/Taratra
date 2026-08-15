import { createHash } from "node:crypto";
import { createLivePilotDataset, type PilotScenarioGroup } from "./live-synthetic-pilot";

export type BenchmarkRunStatus = "PENDING" | "COMPLETED" | "FAILED_RETRYABLE" | "FAILED_FINAL";
export type BenchmarkFailureClass =
  | "BENCHMARK_TIMEOUT"
  | "HARNESS_FAILURE"
  | "PROVIDER_FAILURE"
  | "SEMANTIC_GENERATION_FAILURE"
  | "PERSPECTIVE_FAILURE"
  | "E3_FAILURE"
  | "BRAIN_FAILURE"
  | "SAFETY_FAILURE";

export type PhaseBStage =
  | "RUN_START"
  | "SCHEDULER_QUEUE_ENTER"
  | "SCHEDULER_QUEUE_EXIT"
  | "COOLDOWN_START"
  | "COOLDOWN_END"
  | "PROVIDER_REQUEST_START"
  | "PROVIDER_RESPONSE_RECEIVED"
  | "PERSPECTIVE_VALIDATION_START"
  | "PERSPECTIVE_VALIDATION_END"
  | "SEMANTIC_REGENERATION_START"
  | "SEMANTIC_REGENERATION_END"
  | "E3_START"
  | "E3_END"
  | "BRAIN_PIPELINE_START"
  | "BRAIN_PIPELINE_END"
  | "EVALUATOR_START"
  | "EVALUATOR_END"
  | "CHECKPOINT_WRITE_START"
  | "CHECKPOINT_WRITE_END"
  | "RUN_END";

export interface PhaseBStageTiming {
  readonly stage: PhaseBStage;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly elapsedMs?: number;
}

export interface PhaseBHeartbeat {
  readonly runId: string;
  readonly currentStage: PhaseBStage;
  readonly lastStageCompleted?: PhaseBStage;
  readonly updatedAt: string;
  readonly elapsedMs: number;
  readonly status: "RUNNING" | "PENDING" | "FAILED_RETRYABLE";
}

export interface PhaseBManifestEntry {
  readonly scenarioId: string;
  readonly scenarioGroup: PilotScenarioGroup;
  readonly variantId: string;
}

export interface PhaseBManifest {
  readonly benchmarkVersion: string;
  readonly datasetVersion: string;
  readonly manifestHash: string;
  readonly entries: readonly PhaseBManifestEntry[];
}

export interface BenchmarkRunRecord {
  readonly runId: string;
  readonly benchmarkVersion: string;
  readonly datasetVersion: string;
  readonly scenarioId: string;
  readonly scenarioGroup: PilotScenarioGroup;
  readonly variantId: string;
  readonly attemptNumber: number;
  readonly provider: string;
  readonly model: string;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly latencyMs?: number;
  readonly status: BenchmarkRunStatus;
  readonly failureClass?: BenchmarkFailureClass;
  readonly initialProviderCalls: number;
  readonly logicalRuns?: number;
  readonly initialLogicalCalls?: number;
  /** Number of actual provider HTTP attempts for this logical run. */
  readonly providerAttempts?: number;
  readonly successfulProviderAttempts?: number;
  readonly failedProviderAttempts?: number;
  readonly rateLimitAttempts?: number;
  readonly timeoutAttempts?: number;
  readonly semanticRegenerationCalls: number;
  readonly httpRetryCalls: number;
  readonly transportCalls: number;
  readonly httpCategory?: "2XX" | "4XX" | "429" | "5XX" | "TIMEOUT" | "ERROR";
  readonly rateLimitCount: number;
  readonly rateLimitRecovered: number;
  readonly firstPassPerspectiveStatus?: "VALID" | "REJECTED";
  readonly finalPerspectiveStatus?: "VALID" | "REJECTED";
  readonly groundTruthLeaks: number;
  readonly unauthorizedFacts: number;
  readonly highRiskUnauthorizedFacts: number;
  readonly inventedMetrics: number;
  readonly inventedSystems: number;
  readonly inventedPolicies: number;
  readonly outOfScopeAssertions: number;
  readonly e3Entered: boolean;
  readonly extractionStatus?: "SUCCESS" | "FAILED";
  readonly groundingStatus?: "SUCCESS" | "FAILED";
  readonly unknownPreservation?: boolean;
  readonly contradictionPreservation?: boolean;
  readonly terminologyMapping?: boolean;
  readonly brainReference?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly reasoningTokens?: number;
  readonly stageTimings?: readonly PhaseBStageTiming[];
  readonly failureStage?: PhaseBStage;
  readonly lastSuccessfulStage?: PhaseBStage;
  readonly resultSummary?: Readonly<Record<string, unknown>>;
}

export interface PhaseBCheckpoint {
  readonly benchmarkRunId: string;
  readonly manifest: PhaseBManifest;
  readonly records: readonly BenchmarkRunRecord[];
  readonly updatedAt: string;
  readonly stoppedReason?: "BATCH_INCOMPLETE" | "SAFETY_STOP";
  readonly heartbeat?: PhaseBHeartbeat;
}

export interface PhaseBCheckpointStore {
  load(benchmarkRunId: string): Promise<PhaseBCheckpoint | undefined>;
  save(checkpoint: PhaseBCheckpoint): Promise<void>;
}

export class InMemoryPhaseBCheckpointStore implements PhaseBCheckpointStore {
  private readonly values = new Map<string, PhaseBCheckpoint>();

  async load(benchmarkRunId: string): Promise<PhaseBCheckpoint | undefined> {
    return this.values.get(benchmarkRunId);
  }

  async save(checkpoint: PhaseBCheckpoint): Promise<void> {
    this.values.set(checkpoint.benchmarkRunId, checkpoint);
  }
}

export interface PhaseBExecutionResult {
  readonly status: Exclude<BenchmarkRunStatus, "PENDING">;
  readonly failureClass?: BenchmarkFailureClass;
  readonly latencyMs: number;
  readonly initialProviderCalls?: number;
  readonly logicalRuns?: number;
  readonly initialLogicalCalls?: number;
  readonly providerAttempts?: number;
  readonly successfulProviderAttempts?: number;
  readonly failedProviderAttempts?: number;
  readonly rateLimitAttempts?: number;
  readonly timeoutAttempts?: number;
  readonly semanticRegenerationCalls?: number;
  readonly httpRetryCalls?: number;
  readonly transportCalls?: number;
  readonly httpCategory?: BenchmarkRunRecord["httpCategory"];
  readonly rateLimitCount?: number;
  readonly rateLimitRecovered?: number;
  readonly firstPassPerspectiveStatus?: BenchmarkRunRecord["firstPassPerspectiveStatus"];
  readonly finalPerspectiveStatus?: BenchmarkRunRecord["finalPerspectiveStatus"];
  readonly groundTruthLeaks?: number;
  readonly unauthorizedFacts?: number;
  readonly highRiskUnauthorizedFacts?: number;
  readonly inventedMetrics?: number;
  readonly inventedSystems?: number;
  readonly inventedPolicies?: number;
  readonly outOfScopeAssertions?: number;
  readonly e3Entered?: boolean;
  readonly extractionStatus?: BenchmarkRunRecord["extractionStatus"];
  readonly groundingStatus?: BenchmarkRunRecord["groundingStatus"];
  readonly unknownPreservation?: boolean;
  readonly contradictionPreservation?: boolean;
  readonly terminologyMapping?: boolean;
  readonly brainReference?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly reasoningTokens?: number;
  readonly stageTimings?: readonly PhaseBStageTiming[];
  readonly failureStage?: PhaseBStage;
  readonly lastSuccessfulStage?: PhaseBStage;
  readonly resultSummary?: Readonly<Record<string, unknown>>;
}

export interface PhaseBRunContext {
  readonly runId: string;
  readonly attemptNumber: number;
  readonly heartbeat?: PhaseBHeartbeat;
  readonly timings: readonly PhaseBStageTiming[];
  markStage(stage: PhaseBStage): Promise<void>;
  completeStage(stage: PhaseBStage): Promise<void>;
  checkpoint(status?: PhaseBHeartbeat["status"]): Promise<void>;
}

export interface PhaseBBatchReport {
  readonly benchmarkRunId: string;
  readonly manifestHash: string;
  readonly plannedLogicalRuns: number;
  readonly completedLogicalRuns: number;
  readonly pendingLogicalRuns: number;
  readonly retryableLogicalRuns: number;
  readonly records: readonly BenchmarkRunRecord[];
  readonly telemetry: PhaseBTelemetry;
  readonly stoppedReason?: PhaseBCheckpoint["stoppedReason"];
}

export interface PhaseBTelemetry {
  readonly logicalRunsCompleted: number;
  readonly logicalRuns: number;
  readonly initialLogicalCalls: number;
  readonly initialProviderCalls: number;
  readonly semanticRegenerationCalls: number;
  readonly httpRetryCalls: number;
  readonly totalTransportCalls: number;
  readonly rateLimitEvents: number;
  readonly rateLimitRecovered: number;
  readonly groundTruthLeaks: number;
  readonly unauthorizedFacts: number;
  readonly highRiskUnauthorizedFacts: number;
  readonly unsafeSignals: number;
  readonly latenciesMs: readonly number[];
  readonly meanLatencyMs: number;
  readonly medianLatencyMs: number;
  readonly p95LatencyMs: number;
  readonly inputTokens: number | undefined;
  readonly outputTokens: number | undefined;
  readonly reasoningTokens: number | undefined;
  readonly providerAttempts: number;
  readonly successfulProviderAttempts: number;
  readonly failedProviderAttempts: number;
  readonly rateLimitAttempts: number;
  readonly timeoutAttempts: number;
  readonly telemetryVersion: "CURRENT" | "LEGACY_INCOMPLETE";
}

const isoNow = (): string => new Date().toISOString();
const stableJson = (value: unknown): string => JSON.stringify(value);
export const DEFAULT_PHASE_B_WALL_CLOCK_MS = 150_000;

export function createPhaseBManifest(
  benchmarkVersion = "e5.2m.1",
  datasetVersion = "live-pilot-v1",
): PhaseBManifest {
  const scenarios = createLivePilotDataset();
  const entries = scenarios.flatMap((scenario) =>
    ["A", "B"].map((variantId) => ({
      scenarioId: scenario.id,
      scenarioGroup: scenario.group,
      variantId,
    })),
  );
  const manifestHash = createHash("sha256")
    .update(stableJson({ benchmarkVersion, datasetVersion, entries }))
    .digest("hex");
  return Object.freeze({
    benchmarkVersion,
    datasetVersion,
    manifestHash,
    entries: Object.freeze(entries.map((entry) => Object.freeze(entry))),
  });
}

function runId(benchmarkRunId: string, entry: PhaseBManifestEntry): string {
  return `${benchmarkRunId}:${entry.scenarioId}:${entry.variantId}`;
}

function percentile(values: readonly number[], fraction: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

export function summarizePhaseBTelemetry(records: readonly BenchmarkRunRecord[]): PhaseBTelemetry {
  const completed = records.filter((record) => record.status !== "PENDING");
  const latencies = completed.flatMap((record) =>
    typeof record.latencyMs === "number" ? [record.latencyMs] : [],
  );
  return Object.freeze({
    logicalRunsCompleted: completed.length,
    logicalRuns: completed.reduce((sum, r) => sum + (r.logicalRuns ?? 1), 0),
    initialLogicalCalls: completed.reduce(
      (sum, r) => sum + (r.initialLogicalCalls ?? r.initialProviderCalls),
      0,
    ),
    initialProviderCalls: completed.reduce((sum, r) => sum + r.initialProviderCalls, 0),
    semanticRegenerationCalls: completed.reduce((sum, r) => sum + r.semanticRegenerationCalls, 0),
    httpRetryCalls: completed.reduce((sum, r) => sum + r.httpRetryCalls, 0),
    totalTransportCalls: completed.reduce((sum, r) => sum + r.transportCalls, 0),
    rateLimitEvents: completed.reduce((sum, r) => sum + r.rateLimitCount, 0),
    rateLimitRecovered: completed.reduce((sum, r) => sum + r.rateLimitRecovered, 0),
    groundTruthLeaks: completed.reduce((sum, r) => sum + r.groundTruthLeaks, 0),
    unauthorizedFacts: completed.reduce((sum, r) => sum + r.unauthorizedFacts, 0),
    highRiskUnauthorizedFacts: completed.reduce((sum, r) => sum + r.highRiskUnauthorizedFacts, 0),
    unsafeSignals: completed.reduce(
      (sum, r) =>
        sum +
        r.highRiskUnauthorizedFacts +
        r.inventedMetrics +
        r.inventedSystems +
        r.inventedPolicies,
      0,
    ),
    latenciesMs: Object.freeze(latencies),
    meanLatencyMs: latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
    medianLatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    inputTokens: completed.every((r) => r.inputTokens === undefined)
      ? undefined
      : completed.reduce((sum, r) => sum + (r.inputTokens ?? 0), 0),
    outputTokens: completed.every((r) => r.outputTokens === undefined)
      ? undefined
      : completed.reduce((sum, r) => sum + (r.outputTokens ?? 0), 0),
    reasoningTokens: completed.every((r) => r.reasoningTokens === undefined)
      ? undefined
      : completed.reduce((sum, r) => sum + (r.reasoningTokens ?? 0), 0),
    providerAttempts: completed.reduce((sum, r) => sum + (r.providerAttempts ?? 0), 0),
    successfulProviderAttempts: completed.reduce(
      (sum, r) => sum + (r.successfulProviderAttempts ?? 0),
      0,
    ),
    failedProviderAttempts: completed.reduce((sum, r) => sum + (r.failedProviderAttempts ?? 0), 0),
    rateLimitAttempts: completed.reduce((sum, r) => sum + (r.rateLimitAttempts ?? 0), 0),
    timeoutAttempts: completed.reduce((sum, r) => sum + (r.timeoutAttempts ?? 0), 0),
    telemetryVersion: completed.some((r) => r.providerAttempts === undefined)
      ? "LEGACY_INCOMPLETE"
      : "CURRENT",
  });
}

export interface ResumablePhaseBOptions {
  readonly benchmarkRunId: string;
  readonly manifest?: PhaseBManifest;
  readonly store: PhaseBCheckpointStore;
  readonly provider: string;
  readonly model: string;
  readonly maxWallClockMs?: number;
  readonly estimatedRunMs?: number;
  /** Optional deterministic cap used for bounded batches and local resume tests. */
  readonly maxLogicalRunsPerBatch?: number;
  readonly execute: (
    entry: PhaseBManifestEntry,
    attemptNumber: number,
    context: PhaseBRunContext,
  ) => Promise<PhaseBExecutionResult>;
}

export class ResumablePhaseBBenchmark {
  private readonly options: ResumablePhaseBOptions;
  private readonly manifest: PhaseBManifest;

  constructor(options: ResumablePhaseBOptions) {
    this.options = options;
    this.manifest = options.manifest ?? createPhaseBManifest();
  }

  async runBatch(): Promise<PhaseBBatchReport> {
    const started = Date.now();
    const existing = await this.options.store.load(this.options.benchmarkRunId);
    if (existing && existing.manifest.manifestHash !== this.manifest.manifestHash)
      throw new Error("Benchmark manifest mismatch; resume requires the frozen manifest");
    const records = new Map((existing?.records ?? []).map((record) => [record.runId, record]));
    let stoppedReason: PhaseBCheckpoint["stoppedReason"];
    let runsThisBatch = 0;
    let heartbeat: PhaseBHeartbeat | undefined;
    for (const entry of this.manifest.entries) {
      const id = runId(this.options.benchmarkRunId, entry);
      const prior = records.get(id);
      if (prior?.status === "COMPLETED" || prior?.status === "FAILED_FINAL") continue;
      const elapsed = Date.now() - started;
      const budget = this.options.maxWallClockMs ?? DEFAULT_PHASE_B_WALL_CLOCK_MS;
      const estimate = this.options.estimatedRunMs ?? 0;
      if (elapsed + estimate > budget) {
        stoppedReason = "BATCH_INCOMPLETE";
        break;
      }
      if (
        typeof this.options.maxLogicalRunsPerBatch === "number" &&
        runsThisBatch >= Math.max(0, this.options.maxLogicalRunsPerBatch)
      ) {
        stoppedReason = "BATCH_INCOMPLETE";
        break;
      }
      const attemptNumber = (prior?.attemptNumber ?? 0) + 1;
      const beganAt = isoNow();
      const stageTimings: PhaseBStageTiming[] = [];
      let currentStage: PhaseBStage = "RUN_START";
      let lastStageCompleted: PhaseBStage | undefined;
      const checkpointStore = this.options.store;
      const benchmarkRunId = this.options.benchmarkRunId;
      const manifest = this.manifest;
      const context: PhaseBRunContext = {
        runId: id,
        attemptNumber,
        get heartbeat() {
          return heartbeat;
        },
        get timings() {
          return Object.freeze([...stageTimings]);
        },
        async markStage(stage) {
          currentStage = stage;
          stageTimings.push({ stage, startedAt: isoNow() });
          heartbeat = {
            runId: id,
            currentStage: stage,
            lastStageCompleted,
            updatedAt: isoNow(),
            elapsedMs: Date.now() - started,
            status: "RUNNING",
          };
          await this.checkpoint();
        },
        async completeStage(stage) {
          const current = stageTimings.findLast((timing) => timing.stage === stage);
          if (current && !current.completedAt) {
            stageTimings[stageTimings.indexOf(current)] = Object.freeze({
              ...current,
              completedAt: isoNow(),
              elapsedMs: Date.now() - new Date(current.startedAt).getTime(),
            });
          }
          lastStageCompleted = stage;
          heartbeat = {
            runId: id,
            currentStage,
            lastStageCompleted,
            updatedAt: isoNow(),
            elapsedMs: Date.now() - started,
            status: "RUNNING",
          };
          await this.checkpoint();
        },
        async checkpoint(status = "RUNNING") {
          heartbeat = heartbeat
            ? Object.freeze({
                ...heartbeat,
                status,
                updatedAt: isoNow(),
                elapsedMs: Date.now() - started,
              })
            : Object.freeze({
                runId: id,
                currentStage,
                lastStageCompleted,
                updatedAt: isoNow(),
                elapsedMs: Date.now() - started,
                status,
              });
          await checkpointStore.save({
            benchmarkRunId,
            manifest,
            records: Object.freeze([...records.values()]),
            updatedAt: isoNow(),
            heartbeat,
          });
        },
      };
      let result: PhaseBExecutionResult;
      try {
        result = await this.options.execute(entry, attemptNumber, context);
      } catch {
        await context.checkpoint("FAILED_RETRYABLE");
        result = {
          status: "FAILED_RETRYABLE",
          failureClass: "HARNESS_FAILURE",
          latencyMs: Date.now() - started,
        };
      }
      const record: BenchmarkRunRecord = Object.freeze({
        runId: id,
        benchmarkVersion: this.manifest.benchmarkVersion,
        datasetVersion: this.manifest.datasetVersion,
        scenarioId: entry.scenarioId,
        scenarioGroup: entry.scenarioGroup,
        variantId: entry.variantId,
        attemptNumber,
        provider: this.options.provider,
        model: this.options.model,
        startedAt: beganAt,
        completedAt: isoNow(),
        ...result,
        initialProviderCalls: result.initialProviderCalls ?? 1,
        logicalRuns: result.logicalRuns ?? 1,
        initialLogicalCalls: result.initialLogicalCalls ?? result.initialProviderCalls ?? 1,
        providerAttempts: result.providerAttempts,
        successfulProviderAttempts: result.successfulProviderAttempts,
        failedProviderAttempts: result.failedProviderAttempts,
        rateLimitAttempts: result.rateLimitAttempts,
        timeoutAttempts: result.timeoutAttempts,
        semanticRegenerationCalls: result.semanticRegenerationCalls ?? 0,
        httpRetryCalls: result.httpRetryCalls ?? 0,
        transportCalls:
          result.transportCalls ??
          (result.initialProviderCalls ?? 1) +
            (result.semanticRegenerationCalls ?? 0) +
            (result.httpRetryCalls ?? 0),
        rateLimitCount: result.rateLimitCount ?? 0,
        rateLimitRecovered: result.rateLimitRecovered ?? 0,
        groundTruthLeaks: result.groundTruthLeaks ?? 0,
        unauthorizedFacts: result.unauthorizedFacts ?? 0,
        highRiskUnauthorizedFacts: result.highRiskUnauthorizedFacts ?? 0,
        inventedMetrics: result.inventedMetrics ?? 0,
        inventedSystems: result.inventedSystems ?? 0,
        inventedPolicies: result.inventedPolicies ?? 0,
        outOfScopeAssertions: result.outOfScopeAssertions ?? 0,
        e3Entered: result.e3Entered ?? false,
        stageTimings: result.stageTimings ?? context.timings,
        failureStage: result.failureStage,
        lastSuccessfulStage: result.lastSuccessfulStage,
        resultSummary: result.resultSummary,
      });
      records.set(id, record);
      runsThisBatch += 1;
      if (
        record.groundTruthLeaks > 0 ||
        record.highRiskUnauthorizedFacts > 0 ||
        record.inventedMetrics > 0 ||
        record.inventedSystems > 0 ||
        record.inventedPolicies > 0
      ) {
        stoppedReason = "SAFETY_STOP";
        break;
      }
      await this.options.store.save({
        benchmarkRunId: this.options.benchmarkRunId,
        manifest: this.manifest,
        records: Object.freeze([...records.values()]),
        updatedAt: isoNow(),
        heartbeat,
      });
    }
    const checkpoint: PhaseBCheckpoint = Object.freeze({
      benchmarkRunId: this.options.benchmarkRunId,
      manifest: this.manifest,
      records: Object.freeze([...records.values()]),
      updatedAt: isoNow(),
      stoppedReason,
      heartbeat,
    });
    await this.options.store.save(checkpoint);
    const values = [...records.values()];
    return Object.freeze({
      benchmarkRunId: this.options.benchmarkRunId,
      manifestHash: this.manifest.manifestHash,
      plannedLogicalRuns: this.manifest.entries.length,
      completedLogicalRuns: values.filter((r) => r.status !== "PENDING").length,
      pendingLogicalRuns:
        this.manifest.entries.length -
        values.filter((r) => r.status === "COMPLETED" || r.status === "FAILED_FINAL").length,
      retryableLogicalRuns: values.filter((r) => r.status === "FAILED_RETRYABLE").length,
      records: Object.freeze(values),
      telemetry: summarizePhaseBTelemetry(values),
      stoppedReason,
    });
  }
}
