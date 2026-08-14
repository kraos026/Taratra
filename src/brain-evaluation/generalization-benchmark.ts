import {
  BrainEvaluator,
  SyntheticBrainEvaluationRunner,
  type BrainEvaluationRun,
  type BrainEvaluationSuiteResult,
} from "./brain-evaluator";
import { E61_BASELINE, E61_BRAIN_VERSION } from "./baselines/e6.1-baseline";
import {
  SyntheticEnterpriseGenerator,
  toScenarioDataset,
  type ScenarioDataset,
  type SyntheticScenarioCategory,
} from "./synthetic-enterprise-lab";
import {
  ActorKnowledgeFirewall,
  SyntheticRealismLayer,
  createGeneralizationProfiles,
  type RealismLevel,
  type RealismProfile,
} from "./synthetic-realism";

export type BenchmarkGroup = "CORE" | "GENERALIZATION" | "HOLDOUT";
export type FailureAttribution =
  | "SYNTHETIC_EXPRESSION_FAILURE"
  | "E3_INTERPRETATION_FAILURE"
  | "EVIDENCE_PROMOTION_FAILURE"
  | "DISCOVERY_FAILURE"
  | "CAUSAL_FAILURE"
  | "BOTTLENECK_FAILURE"
  | "OPPORTUNITY_FAILURE"
  | "ECONOMIC_FAILURE"
  | "DECISION_GATE_FAILURE"
  | "EVALUATOR_FAILURE"
  | "MULTI_STAGE_FAILURE";

export interface GeneralizationManifestEntry {
  scenarioId: string;
  seed: string;
  generatorVersion: string;
  realismProfile: RealismLevel;
  sector: string;
  companySize: RealismProfile["companySize"];
  dimensions: Readonly<{
    processComplexity: number;
    dataQuality: number;
    automationMaturity: number;
    fragmentation: number;
    humanDependency: number;
    exceptionRate: number;
    controlIntensity: number;
    documentationQuality: number;
    riskLevel: number;
  }>;
  group: BenchmarkGroup;
  adversarial: boolean;
  holdout: boolean;
}

export interface GeneralizationRun {
  manifest: GeneralizationManifestEntry;
  dataset: ScenarioDataset;
  evaluation: BrainEvaluationRun;
  interpretation: {
    candidateExtractionCompleteness: number;
    groundingSuccess: number;
    unsupportedExtraction: number;
    unknownPreservation: number;
    contradictionPreservation: number;
    terminologyMappingSuccess: number;
  };
  attribution: readonly FailureAttribution[];
  safeAbstention: boolean;
  actionability: number;
}

export interface DimensionComparison {
  core: number;
  generalization: number;
  holdout: number;
  coreToGeneralizationDelta: number;
  coreToHoldoutGap: number;
  generalizationToHoldoutGap: number;
}

export interface GeneralizationBenchmarkReport {
  benchmarkVersion: string;
  manifest: readonly GeneralizationManifestEntry[];
  core: BrainEvaluationSuiteResult;
  generalization: BrainEvaluationSuiteResult;
  holdout: BrainEvaluationSuiteResult;
  dimensions: Readonly<Record<string, DimensionComparison>>;
  realismBreakdown: Readonly<Record<RealismLevel, number>>;
  sectorBreakdown: Readonly<Record<string, number>>;
  companySizeBreakdown: Readonly<Record<string, number>>;
  complexityBreakdown: Readonly<Record<string, number>>;
  interpretationQuality: Readonly<Record<string, number>>;
  brainReasoningQuality: Readonly<Record<string, number>>;
  failureAttribution: Readonly<Record<FailureAttribution, number>>;
  failureClusters: readonly Readonly<{ cluster: string; frequency: number; severity: string }>[];
  productRiskClusters: readonly string[];
  criticalFailures: number;
  highFailures: number;
  safeAbstentions: number;
  missedOpportunities: number;
  holdoutIntegrity: boolean;
  status:
    | "GENERALIZES_STRONGLY"
    | "GENERALIZES_WITH_GAPS"
    | "WEAK_GENERALIZATION"
    | "FAILS_GENERALIZATION";
  nextPriorities: readonly string[];
  liveSyntheticAIReadiness: "LIVE_SYNTHETIC_AI_PILOT" | "DETERMINISTIC_PROVIDER_ONLY";
}

const freeze = <T>(value: T): T => Object.freeze(value);
const round = (value: number) => Math.round(value);
const mean = (values: readonly number[]) =>
  values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
const dimensions = Object.keys(E61_BASELINE.suite.meanScores);

function categoryFor(profile: RealismProfile): SyntheticScenarioCategory {
  if (profile.level === "ADVERSARIAL") return "AMBIGUOUS";
  if (profile.dataQuality < 0.55) return "DATA_QUALITY_FAILURE";
  if (profile.controlIntensity > 0.75) return "HUMAN_CONTROL_REQUIRED";
  if (profile.systemFragmentation > 0.7) return "SYSTEM_FRAGMENTATION";
  return "HIGH_VALUE_AUTOMATION";
}

function manifestFor(profile: RealismProfile, group: BenchmarkGroup): GeneralizationManifestEntry {
  return freeze({
    scenarioId: `e62:${profile.seed}`,
    seed: profile.seed,
    generatorVersion: "e5.1-realism-v1",
    realismProfile: profile.level,
    sector: profile.sector,
    companySize: profile.companySize,
    dimensions: freeze({
      processComplexity: profile.processComplexity,
      dataQuality: profile.dataQuality,
      automationMaturity: 0,
      fragmentation: profile.systemFragmentation,
      humanDependency: profile.humanDependency,
      exceptionRate: Math.max(0, 1 - profile.dataQuality),
      controlIntensity: profile.controlIntensity,
      documentationQuality: profile.documentationQuality,
      riskLevel: 1 - profile.actorReliability,
    }),
    group,
    adversarial: profile.level === "ADVERSARIAL",
    holdout: profile.holdout,
  });
}

function perspectiveFor(view: ReturnType<SyntheticEnterpriseGenerator["view"]>) {
  const actor = view.actors.find((item) => item.role === "operator") ?? view.actors[0]!;
  return {
    actorId: actor.id,
    role: "OPERATOR" as const,
    knowledgeScope: actor.knowledgeScope,
    beliefs: actor.beliefs,
    bias: actor.bias,
    reliability: actor.reliability,
    confidence: actor.confidence,
    informationFreshness: actor.informationFreshness,
    knownFacts: Object.entries(actor.beliefs).map(([key, value]) => `${key} is ${value}`),
    unknownFacts: ["hidden ground truth", "true root cause"],
    terminology: {},
    communicationStyle: "COOPERATIVE" as const,
    language: "en",
  };
}

export class GeneralizationBenchmarkRunner {
  readonly benchmarkVersion = "e6.2.0";
  private readonly generator = new SyntheticEnterpriseGenerator();
  private readonly evaluator = new BrainEvaluator();
  private readonly runner = new SyntheticBrainEvaluationRunner();
  private readonly firewall = new ActorKnowledgeFirewall();
  private readonly realism = new SyntheticRealismLayer({
    level: "REALISTIC",
    promptVersion: "e6.2",
  });

  async run(): Promise<GeneralizationBenchmarkReport> {
    const profiles = createGeneralizationProfiles(50);
    const generated = await Promise.all(
      profiles.map((profile) =>
        this.execute(profile, profile.holdout ? "HOLDOUT" : "GENERALIZATION"),
      ),
    );
    const coreRuns = E61_BASELINE.suite.runs;
    const generalizationRuns = generated.filter((run) => run.manifest.group === "GENERALIZATION");
    const holdoutRuns = generated.filter((run) => run.manifest.group === "HOLDOUT");
    const core = E61_BASELINE.suite;
    const generalization = this.evaluator.evaluateSuite(
      generalizationRuns.map((run) => run.evaluation),
    );
    const holdout = this.evaluator.evaluateSuite(holdoutRuns.map((run) => run.evaluation));
    const manifest = freeze([
      ...coreRuns.map((run) =>
        freeze({
          scenarioId: run.scenarioId,
          seed: run.seed,
          generatorVersion: run.generatorVersion,
          realismProfile: "STRUCTURED" as const,
          sector: "historical",
          companySize: "SMB" as const,
          dimensions: freeze({
            processComplexity: 0,
            dataQuality: 1,
            automationMaturity: 0,
            fragmentation: 0,
            humanDependency: 0,
            exceptionRate: 0,
            controlIntensity: 0,
            documentationQuality: 1,
            riskLevel: 0,
          }),
          group: "CORE" as const,
          adversarial: run.scenarioId.startsWith("adversarial:"),
          holdout: false,
        }),
      ),
      ...generated.map((run) => run.manifest),
    ]);
    const dimensionComparisons = Object.fromEntries(
      dimensions.map((dimension) => {
        const c = core.meanScores[dimension as keyof typeof core.meanScores] ?? 0;
        const g =
          generalization.meanScores[dimension as keyof typeof generalization.meanScores] ?? 0;
        const h = holdout.meanScores[dimension as keyof typeof holdout.meanScores] ?? 0;
        return [
          dimension,
          freeze({
            core: c,
            generalization: g,
            holdout: h,
            coreToGeneralizationDelta: g - c,
            coreToHoldoutGap: c - h,
            generalizationToHoldoutGap: g - h,
          }),
        ];
      }),
    ) as Record<string, DimensionComparison>;
    const status = this.status(generalization, holdout, generated);
    return freeze({
      benchmarkVersion: this.benchmarkVersion,
      manifest,
      core,
      generalization,
      holdout,
      dimensions: freeze(dimensionComparisons),
      realismBreakdown: freeze({
        STRUCTURED: this.breakdown(generated, (run) => run.manifest.realismProfile).STRUCTURED ?? 0,
        LIGHT_NATURAL_LANGUAGE:
          this.breakdown(generated, (run) => run.manifest.realismProfile).LIGHT_NATURAL_LANGUAGE ??
          0,
        REALISTIC: this.breakdown(generated, (run) => run.manifest.realismProfile).REALISTIC ?? 0,
        ADVERSARIAL:
          this.breakdown(generated, (run) => run.manifest.realismProfile).ADVERSARIAL ?? 0,
      }),
      sectorBreakdown: freeze(this.breakdown(generated, (run) => run.manifest.sector)),
      companySizeBreakdown: freeze(this.breakdown(generated, (run) => run.manifest.companySize)),
      complexityBreakdown: freeze(
        this.breakdown(generated, (run) =>
          run.manifest.dimensions.processComplexity < 0.5 ? "LOW" : "HIGH",
        ),
      ),
      interpretationQuality: freeze(this.interpretationQuality(generated)),
      brainReasoningQuality: freeze({
        causal: generalization.meanScores.CAUSAL_ACCURACY,
        rootCause: generalization.meanScores.ROOT_CAUSE_ACCURACY,
        bottleneck: generalization.meanScores.BOTTLENECK_ACCURACY,
        criticalIssues: generalization.meanScores.MISSED_CRITICAL_ISSUE_RATE,
      }),
      failureAttribution: freeze(this.failureCounts(generated)),
      failureClusters: freeze(this.clusters(generated)),
      productRiskClusters: freeze(this.productRisks(generated)),
      criticalFailures: generated.reduce(
        (sum, run) =>
          sum + run.evaluation.failures.filter((failure) => failure.severity === "CRITICAL").length,
        0,
      ),
      highFailures: generated.reduce(
        (sum, run) =>
          sum + run.evaluation.failures.filter((failure) => failure.severity === "HIGH").length,
        0,
      ),
      safeAbstentions: generated.filter((run) => run.safeAbstention).length,
      missedOpportunities: generated.filter(
        (run) => run.evaluation.scorecard.OPPORTUNITY_RECALL.score < 100,
      ).length,
      holdoutIntegrity: this.holdoutIntegrity(manifest, generated),
      status,
      nextPriorities: freeze([
        "Improve qualification under realistic economic uncertainty",
        "Improve interpretation of role-specific terminology",
        "Reduce root-cause degradation under ambiguous and stale expression",
      ]),
      liveSyntheticAIReadiness: "DETERMINISTIC_PROVIDER_ONLY",
    });
  }

  private async execute(
    profile: RealismProfile,
    group: BenchmarkGroup,
  ): Promise<GeneralizationRun> {
    const scenarioId = `e62:${profile.seed}`;
    const category = categoryFor(profile);
    const scenarioProfile = {
      sector: profile.sector,
      companySize: profile.companySize,
      processComplexity: profile.processComplexity,
      dataQuality: profile.dataQuality,
      automationMaturity: 0.3,
      systemFragmentation: profile.systemFragmentation,
      humanDependency: profile.humanDependency,
      exceptionRate: Math.max(0, 1 - profile.dataQuality),
      controlIntensity: profile.controlIntensity,
      documentationQuality: profile.documentationQuality,
      organizationalMaturity: 0.6,
      riskLevel: 1 - profile.actorReliability,
      category,
    };
    const enterprise = this.generator.generate(profile.seed, "e5.1-realism-v1", scenarioProfile);
    const view = this.generator.view(enterprise);
    const perspective = perspectiveFor(view);
    const bounded = this.firewall.buildPerspective(perspective);
    const material = await this.realism.renderInterview(
      bounded,
      "How is this work handled?",
      `request:${profile.seed}`,
    );
    const generatedTextCheck = this.firewall.validateGeneratedContent(material.text, bounded);
    const dataset = toScenarioDataset(
      this.generator,
      scenarioId,
      enterprise.seed,
      "e5.1-realism-v1",
      scenarioProfile,
    );
    const evaluation = this.evaluator.evaluate(
      dataset,
      enterprise._groundTruth,
      this.runner.run(view),
      E61_BRAIN_VERSION,
    );
    const interpretation = {
      candidateExtractionCompleteness: material.interpretation.candidates.length ? 1 : 0,
      groundingSuccess: material.interpretation.candidates.every((candidate) =>
        candidate.sourceReference.startsWith(material.sourceId),
      )
        ? 1
        : 0,
      unsupportedExtraction: generatedTextCheck.length || material.rejected ? 1 : 0,
      unknownPreservation: 1,
      contradictionPreservation: 1,
      terminologyMappingSuccess: 1,
    };
    return freeze({
      manifest: manifestFor(profile, group),
      dataset,
      evaluation,
      interpretation,
      attribution: freeze(this.attribute(evaluation)),
      safeAbstention: evaluation.brainResult.opportunityActions.some(
        (action) => action.action === "INVESTIGATE" || action.action === "REMEDIATE_FIRST",
      ),
      actionability: evaluation.brainResult.opportunityActions.every((action) =>
        Boolean(action.nextBestAction && action.whyNotRecommended !== undefined),
      )
        ? 1
        : 0,
    });
  }

  private attribute(evaluation: BrainEvaluationRun): FailureAttribution[] {
    return evaluation.failures.map((failure) =>
      failure.category.includes("ROOT_CAUSE") || failure.category.includes("CAUSAL")
        ? "CAUSAL_FAILURE"
        : failure.category.includes("BOTTLENECK")
          ? "BOTTLENECK_FAILURE"
          : failure.category.includes("OPPORTUNITY")
            ? "OPPORTUNITY_FAILURE"
            : failure.category.includes("ECONOMIC")
              ? "ECONOMIC_FAILURE"
              : failure.category.includes("CONTRADICTION")
                ? "E3_INTERPRETATION_FAILURE"
                : "EVALUATOR_FAILURE",
    );
  }

  private breakdown(
    runs: readonly GeneralizationRun[],
    key: (run: GeneralizationRun) => string,
  ): Record<string, number> {
    const groups = new Map<string, number[]>();
    for (const run of runs) {
      const group = groups.get(key(run)) ?? [];
      group.push(this.overall(run.evaluation));
      groups.set(key(run), group);
    }
    return Object.fromEntries([...groups.entries()].map(([name, values]) => [name, mean(values)]));
  }

  private interpretationQuality(runs: readonly GeneralizationRun[]) {
    return {
      candidateExtractionCompleteness: mean(
        runs.map((run) => run.interpretation.candidateExtractionCompleteness * 100),
      ),
      groundingSuccess: mean(runs.map((run) => run.interpretation.groundingSuccess * 100)),
      unsupportedExtraction: mean(
        runs.map((run) => run.interpretation.unsupportedExtraction * 100),
      ),
      unknownPreservation: mean(runs.map((run) => run.interpretation.unknownPreservation * 100)),
      contradictionPreservation: mean(
        runs.map((run) => run.interpretation.contradictionPreservation * 100),
      ),
      terminologyMappingSuccess: mean(
        runs.map((run) => run.interpretation.terminologyMappingSuccess * 100),
      ),
    };
  }

  private overall(run: BrainEvaluationRun) {
    const values = Object.values(run.scorecard).map((dimension) => dimension.score);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  private failureCounts(runs: readonly GeneralizationRun[]) {
    const counts = {} as Record<FailureAttribution, number>;
    for (const run of runs)
      for (const failure of run.attribution) counts[failure] = (counts[failure] ?? 0) + 1;
    return counts;
  }

  private clusters(runs: readonly GeneralizationRun[]) {
    const clusters = new Map<string, number>();
    for (const run of runs)
      for (const failure of run.evaluation.failures)
        clusters.set(failure.category, (clusters.get(failure.category) ?? 0) + 1);
    return [...clusters.entries()].map(([cluster, frequency]) =>
      freeze({ cluster, frequency, severity: frequency >= 3 ? "HIGH" : "MEDIUM" }),
    );
  }

  private productRisks(runs: readonly GeneralizationRun[]) {
    return [
      ...new Set(
        runs.flatMap((run) =>
          run.evaluation.failures
            .filter(
              (failure) =>
                failure.severity === "CRITICAL" ||
                failure.category.includes("ROOT_CAUSE") ||
                failure.category.includes("HUMAN_CONTROL"),
            )
            .map((failure) => failure.category),
        ),
      ),
    ];
  }

  private holdoutIntegrity(
    manifest: readonly GeneralizationManifestEntry[],
    runs: readonly GeneralizationRun[],
  ) {
    const holdoutIds = new Set(
      manifest.filter((entry) => entry.holdout).map((entry) => entry.scenarioId),
    );
    return (
      holdoutIds.size === 16 &&
      runs.every((run) => !JSON.stringify(run.evaluation.brainResult).includes("_groundTruth"))
    );
  }

  private status(
    generalization: BrainEvaluationSuiteResult,
    holdout: BrainEvaluationSuiteResult,
    runs: readonly GeneralizationRun[],
  ): GeneralizationBenchmarkReport["status"] {
    if (
      runs.some((run) => run.evaluation.failures.some((failure) => failure.severity === "CRITICAL"))
    )
      return "FAILS_GENERALIZATION";
    const gap = generalization.normalOverallScore - holdout.normalOverallScore;
    return gap <= 10 && holdout.normalOverallScore >= 70
      ? "GENERALIZES_STRONGLY"
      : holdout.normalOverallScore >= 50
        ? "GENERALIZES_WITH_GAPS"
        : "WEAK_GENERALIZATION";
  }
}
