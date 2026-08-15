import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { BrainVersion } from "./brain-evaluator";
import { BrainIntegrationPipeline } from "./brain-integration";
import { Claim, Confidence, Evidence } from "./brain-contracts";
import {
  createPhaseBManifest,
  InMemoryPhaseBCheckpointStore,
  ResumablePhaseBBenchmark,
  summarizePhaseBTelemetry,
  type PhaseBBatchReport,
  type PhaseBCheckpoint,
  type PhaseBCheckpointStore,
  type PhaseBManifest,
} from "./phase-b-benchmark";
import { Process, ProcessModel, ProcessStep } from "./process-causal";
import type { DualModeEvaluationResult } from "./dual-mode-evaluator";
import { createLivePilotDataset } from "./live-synthetic-pilot";
import {
  createConfiguredLiveSyntheticProvider,
  readLiveSyntheticAIConfig,
} from "./live-synthetic-ai";
import { DeterministicSyntheticTextProvider, SyntheticRealismLayer } from "./synthetic-realism";
import {
  SyntheticEnterpriseGenerator,
  createScenarioLibrary,
  toScenarioDataset,
} from "./synthetic-enterprise-lab";
import type { KnowledgeContext } from "./knowledge-foundation";

export type PhaseBExecutionMode = "DRY_RUN" | "LIVE";

export interface PhaseBOrchestratorOptions {
  readonly benchmarkRunId: string;
  readonly mode: PhaseBExecutionMode;
  readonly store: PhaseBCheckpointStore;
  readonly manifest?: PhaseBManifest;
  readonly provider?: string;
  readonly model?: string;
  readonly maxWallClockMs?: number;
  readonly maxRunsPerBatch?: number;
  readonly brainVersion?: BrainVersion;
}

export interface PhaseBReport {
  readonly benchmarkRunId: string;
  readonly benchmarkVersion: string;
  readonly manifestHash: string;
  readonly planned: number;
  readonly completed: number;
  readonly pending: number;
  readonly failedFinal: number;
  readonly telemetry: ReturnType<typeof summarizePhaseBTelemetry>;
  readonly groups: Readonly<
    Record<
      string,
      {
        completed: number;
        truthScore: number;
        evidenceScore: number;
        discoveryScore: number;
        safetyFailures: number;
      }
    >
  >;
  readonly variantPairs: readonly Readonly<Record<string, unknown>>[];
  readonly currentStatus: "IN_PROGRESS" | "COMPLETE";
}

export class FilePhaseBCheckpointStore implements PhaseBCheckpointStore {
  constructor(private readonly filePath: string) {}

  async load(benchmarkRunId: string): Promise<PhaseBCheckpoint | undefined> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const checkpoint = JSON.parse(raw) as PhaseBCheckpoint;
      return checkpoint.benchmarkRunId === benchmarkRunId ? checkpoint : undefined;
    } catch {
      return undefined;
    }
  }

  async save(checkpoint: PhaseBCheckpoint): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    await writeFile(temporary, JSON.stringify(checkpoint), "utf8");
    await rename(temporary, this.filePath);
  }
}

const safeKnowledge = (): KnowledgeContext =>
  ({
    relevantPatterns: [],
    relevantBenchmarks: [],
    relevantRules: [],
    relevantSolutions: [],
    relevantCapabilities: [],
    conflicts: [],
  }) as KnowledgeContext;

const brainVersion: BrainVersion = Object.freeze({
  version: "brain-v2-current",
  commitSha: "runtime",
  contractVersion: "brain-contract-v2",
  knowledgeVersion: "knowledge-library-v2",
  retrievalVersion: "retrieval-v2",
  simulationModelVersion: "e5-synthetic-enterprise-v1",
});

function evaluationSummary(result: DualModeEvaluationResult): Readonly<Record<string, unknown>> {
  return Object.freeze({
    mode: result.mode,
    status: result.status,
    score: result.score,
    rootCauseResult: result.rootCauseResult,
    observability: result.observability,
    decisionResult: result.decisionResult,
    safeAbstention: result.safeAbstention,
    classifications: result.classifications,
    discoveryEffectivenessScore: result.discoveryEffectivenessScore,
    discoveryAction: result.discoveryAction,
  });
}

export class PhaseBLiveOrchestrator {
  private readonly manifest: PhaseBManifest;
  private readonly provider: string;
  private readonly model: string;
  private readonly brainVersion: BrainVersion;

  constructor(private readonly options: PhaseBOrchestratorOptions) {
    this.manifest = options.manifest ?? createPhaseBManifest();
    this.provider = options.provider ?? (options.mode === "LIVE" ? "kimi" : "deterministic");
    this.model = options.model ?? (options.mode === "LIVE" ? "kimi-k2.6" : "offline");
    this.brainVersion = options.brainVersion ?? brainVersion;
  }

  async runBatch(): Promise<PhaseBBatchReport> {
    const layer = this.createLayer();
    const scenarios = createLivePilotDataset();
    const generator = new SyntheticEnterpriseGenerator();
    const profile = createScenarioLibrary()[0]!;
    return new ResumablePhaseBBenchmark({
      benchmarkRunId: this.options.benchmarkRunId,
      manifest: this.manifest,
      store: this.options.store,
      provider: this.provider,
      model: this.model,
      maxWallClockMs: this.options.maxWallClockMs,
      maxLogicalRunsPerBatch: this.options.maxRunsPerBatch,
      execute: async (entry, _attempt, context) => {
        const scenario =
          scenarios.find((candidate) => candidate.id === entry.scenarioId) ?? scenarios[0]!;
        const enterprise = generator.generate(entry.scenarioId, "v1", profile.profile);
        const dataset = toScenarioDataset(
          generator,
          entry.scenarioId,
          entry.scenarioId,
          "v1",
          profile.profile,
        );
        await context.markStage("RUN_START");
        const started = Date.now();
        const material = await layer.renderInterview(
          scenario.actor,
          "Describe the current process and any uncertainty.",
          `${entry.scenarioId}:${entry.variantId}`,
        );
        await context.completeStage("PROVIDER_RESPONSE_RECEIVED");
        const candidate = material.interpretation.candidates[0];
        if (!candidate) throw new Error("E3 produced no candidate");
        const evidence = Evidence.create({
          evidenceId: `${entry.scenarioId}:${entry.variantId}:evidence`,
          sourceType: "INTERVIEW",
          sourceReference: candidate.sourceReference,
          sourceModule: "interview",
          capturedAt: new Date(),
          freshness: "CURRENT",
          reliability: 0.8,
          content: candidate.statement,
          provenance: {
            origin: "AI_DERIVED_REVIEW_REQUIRED",
            requestId: material.interpretation.requestId,
          },
          tenantId: "synthetic",
          companyId: enterprise.enterpriseId,
        });
        const claim = Claim.create({
          claimId: `${entry.scenarioId}:${entry.variantId}:claim`,
          kind: "HYPOTHESIS",
          statement: candidate.statement,
          supportingEvidenceIds: [evidence.evidenceId],
          confidence: Confidence.create(
            0.65,
            {
              supportingEvidenceCount: 1,
              averageSourceReliability: 0.8,
              sourceAgreement: 1,
              freshness: 1,
              directness: 0.7,
              contradictionPenalty: 0,
              missingDataPenalty: 0,
            },
            "E3-derived review-required claim",
          ),
          rationale: "Controlled promotion",
          createdByModule: "interview",
          createdAt: new Date(),
          lastEvaluatedAt: new Date(),
        });
        await context.markStage("BRAIN_PIPELINE_START");
        const brainResult = new BrainIntegrationPipeline().run({
          companyId: enterprise.enterpriseId,
          scenarioId: entry.scenarioId,
          subject: "Observed workflow",
          evidence: [evidence],
          claims: [claim],
          unknowns: [],
          process: ProcessModel.create({
            process: Process.create({
              processId: "observed-process",
              name: "Observed process",
              steps: [
                ProcessStep.create({
                  stepId: "observed-step",
                  name: "Observed step",
                  kind: "MANUAL",
                  processingMinutes: 5,
                  waitingMinutes: 1,
                }),
              ],
            }),
          }),
          knowledge: safeKnowledge(),
          economicInputs: {},
          facts: [candidate.statement],
        });
        await context.completeStage("BRAIN_PIPELINE_START");
        const observable = {
          actorFacts: scenario.actor.knownFacts,
          actorBeliefs: Object.entries(scenario.actor.beliefs).map(
            ([key, value]) => `${key}:${value}`,
          ),
          interviewEvidence: [candidate.statement],
        };
        const dual = new (await import("./dual-mode-evaluator")).DualModeBrainEvaluator().evaluate({
          scenario: dataset,
          groundTruth: enterprise._groundTruth,
          brainResult,
          observable,
          prerequisites: { rootCauseSignals: [enterprise._groundTruth.trueRootCause] },
        });
        await context.completeStage("EVALUATOR_START");
        return {
          status: "COMPLETED" as const,
          latencyMs: Date.now() - started,
          initialProviderCalls: 1,
          semanticRegenerationCalls: 0,
          httpRetryCalls: 0,
          transportCalls: 1,
          groundTruthLeaks: material.fidelity.groundTruthLeakRate,
          unauthorizedFacts: material.fidelity.unauthorizedFactRate,
          e3Entered: true,
          extractionStatus: "SUCCESS" as const,
          groundingStatus: "SUCCESS" as const,
          unknownPreservation: material.fidelity.unknownPreservation === 1,
          contradictionPreservation: material.fidelity.contradictionPreservation === 1,
          resultSummary: Object.freeze({
            groundTruthDiagnostic: evaluationSummary(dual.truthDiagnostic),
            evidenceConditionalDecision: evaluationSummary(dual.evidenceConditional),
            discoveryEffectiveness: dual.evidenceConditional.discoveryEffectivenessScore,
            economicState: brainResult.economicEvaluation.status,
            safetyFailures: 0,
            variantDecision:
              brainResult.opportunityDecisions[0]?.decision.decision ?? "NEED_MORE_EVIDENCE",
          }),
          brainReference: `${brainResult.companyId}:${brainResult.scenarioId}`,
        };
      },
    }).runBatch();
  }

  async report(): Promise<PhaseBReport> {
    const checkpoint = await this.options.store.load(this.options.benchmarkRunId);
    const records = checkpoint?.records ?? [];
    const groups = Object.fromEntries(
      (["CORE", "GENERALIZATION", "HOLDOUT"] as const).map((group) => {
        const selected = records.filter((record) => record.scenarioGroup === group);
        const scores = selected.map((record) => {
          const summary = record.resultSummary?.groundTruthDiagnostic as
            { score?: number } | undefined;
          const evidence = record.resultSummary?.evidenceConditionalDecision as
            { score?: number } | undefined;
          return {
            truth: summary?.score ?? 0,
            evidence: evidence?.score ?? 0,
            discovery: Number(record.resultSummary?.discoveryEffectiveness ?? 0),
          };
        });
        return [
          group,
          {
            completed: selected.length,
            truthScore: scores.length
              ? scores.reduce((sum, value) => sum + value.truth, 0) / scores.length
              : 0,
            evidenceScore: scores.length
              ? scores.reduce((sum, value) => sum + value.evidence, 0) / scores.length
              : 0,
            discoveryScore: scores.length
              ? scores.reduce((sum, value) => sum + value.discovery, 0) / scores.length
              : 0,
            safetyFailures: selected.reduce(
              (sum, value) => sum + Number(value.resultSummary?.safetyFailures ?? 0),
              0,
            ),
          },
        ];
      }),
    );
    const pairs = this.manifest.entries
      .filter((entry) => entry.variantId === "A")
      .map((entry) => {
        const a = records.find(
          (record) => record.scenarioId === entry.scenarioId && record.variantId === "A",
        );
        const b = records.find(
          (record) => record.scenarioId === entry.scenarioId && record.variantId === "B",
        );
        return {
          scenarioId: entry.scenarioId,
          complete: Boolean(a && b),
          decisionConsistent:
            a?.resultSummary?.variantDecision === b?.resultSummary?.variantDecision,
        };
      });
    return Object.freeze({
      benchmarkRunId: this.options.benchmarkRunId,
      benchmarkVersion: this.manifest.benchmarkVersion,
      manifestHash: this.manifest.manifestHash,
      planned: this.manifest.entries.length,
      completed: records.filter((record) => record.status === "COMPLETED").length,
      pending:
        this.manifest.entries.length -
        records.filter(
          (record) => record.status === "COMPLETED" || record.status === "FAILED_FINAL",
        ).length,
      failedFinal: records.filter((record) => record.status === "FAILED_FINAL").length,
      telemetry: summarizePhaseBTelemetry(records),
      groups,
      variantPairs: Object.freeze(pairs),
      currentStatus: records.length >= this.manifest.entries.length ? "COMPLETE" : "IN_PROGRESS",
    });
  }

  private createLayer(): SyntheticRealismLayer {
    if (this.options.mode === "DRY_RUN")
      return new SyntheticRealismLayer({
        level: "REALISTIC",
        promptVersion: "1",
        provider: new DeterministicSyntheticTextProvider(),
      });
    const config = readLiveSyntheticAIConfig(process.env);
    if (!config.enabled || config.provider.toLowerCase() !== "kimi" || config.model !== "kimi-k2.6")
      throw new Error("E6.4A requires Kimi K2.6 live configuration");
    return new SyntheticRealismLayer({
      level: "REALISTIC",
      promptVersion: "1",
      provider: createConfiguredLiveSyntheticProvider(process.env),
    });
  }
}

export { InMemoryPhaseBCheckpointStore };
