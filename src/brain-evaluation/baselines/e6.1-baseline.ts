import {
  BrainEvaluator,
  SyntheticBrainEvaluationRunner,
  type BrainEvaluationRun,
  type BrainEvaluationSuiteResult,
  type BrainQualityReport,
  type BrainVersion,
  type EvaluationDimension,
} from "../brain-evaluator";
import {
  SyntheticEnterpriseGenerator,
  createAdversarialScenarioLibrary,
  createScenarioLibrary,
  toScenarioDataset,
} from "../synthetic-enterprise-lab";

export const E61_BASELINE_VERSION = "e6.1.0";
export const E61_BRAIN_VERSION: BrainVersion = Object.freeze({
  version: "brain-v2-current",
  commitSha: "7fd8d39df621a6eef604c5b8417b55f9e7cb9a6d",
  contractVersion: "brain-contract-v2",
  knowledgeVersion: "knowledge-library-v2",
  retrievalVersion: "retrieval-v2",
  simulationModelVersion: "e5-synthetic-enterprise-v1",
});

export interface BaselineDimensionMetric {
  score: number;
  sampleCount: number;
  rawMetrics: Readonly<Record<string, number>>;
}
export interface E61BaselineArtifact {
  baselineVersion: string;
  brainVersion: BrainVersion;
  evaluatorVersion: string;
  generatorVersion: string;
  scenarioSeeds: readonly string[];
  normalScenarioIds: readonly string[];
  adversarialScenarioIds: readonly string[];
  suite: BrainEvaluationSuiteResult;
  dimensionScorecard: Readonly<Record<EvaluationDimension, BaselineDimensionMetric>>;
  qualityReport: BrainQualityReport;
  scenarioResults: readonly Readonly<Record<string, unknown>>[];
  nextPriorities: readonly Readonly<Record<string, unknown>>[];
}

export function runE61Baseline(): E61BaselineArtifact {
  const generator = new SyntheticEnterpriseGenerator();
  const evaluator = new BrainEvaluator();
  const runner = new SyntheticBrainEvaluationRunner();
  const normal = createScenarioLibrary().map((entry) => ({
    scenarioId: entry.seed,
    profile: entry.profile,
    tags: [entry.profile.category],
  }));
  const adversarial = createAdversarialScenarioLibrary().map((dataset) => ({
    scenarioId: dataset.scenarioId,
    profile: createScenarioLibrary()[0]!.profile,
    tags: ["ADVERSARIAL", ...dataset.tags],
  }));
  const entries = [...normal, ...adversarial];
  const runs: BrainEvaluationRun[] = entries.map((entry) => {
    const enterprise = generator.generate(
      entry.scenarioId.replace("adversarial:", ""),
      "v1",
      entry.profile,
    );
    const dataset = toScenarioDataset(
      generator,
      entry.scenarioId,
      enterprise.seed,
      "v1",
      entry.profile,
    );
    const result = runner.run(generator.view(enterprise));
    return evaluator.evaluate(dataset, enterprise._groundTruth, result, E61_BRAIN_VERSION);
  });
  const suite = evaluator.evaluateSuite(runs);
  const dimensions = Object.keys(suite.meanScores) as EvaluationDimension[];
  const dimensionScorecard = Object.freeze(
    Object.fromEntries(
      dimensions.map((dimension) => {
        const rawMetrics = Object.fromEntries(
          runs.map((run) => [run.scenarioId, run.scorecard[dimension].score]),
        );
        return [
          dimension,
          Object.freeze({
            score: suite.meanScores[dimension],
            sampleCount: runs.length,
            rawMetrics: Object.freeze(rawMetrics),
          }),
        ];
      }),
    ) as Record<EvaluationDimension, BaselineDimensionMetric>,
  );
  const scenarioResults = Object.freeze(
    runs.map((run) =>
      Object.freeze({
        scenarioId: run.scenarioId,
        category: run.scenarioId.startsWith("adversarial:") ? "ADVERSARIAL" : "BASELINE",
        status: run.status,
        overallScore:
          dimensions.reduce((sum, dimension) => sum + run.scorecard[dimension].score, 0) /
          dimensions.length,
        lowestDimensions: dimensions.filter((dimension) => run.scorecard[dimension].score < 70),
        criticalFailures: run.failures
          .filter((failure) => failure.severity === "CRITICAL")
          .map((failure) => failure.explanation),
        highFailures: run.failures
          .filter((failure) => failure.severity === "HIGH")
          .map((failure) => failure.explanation),
      }),
    ),
  );
  const qualityReport = evaluator.qualityReport(suite);
  return Object.freeze({
    baselineVersion: E61_BASELINE_VERSION,
    brainVersion: E61_BRAIN_VERSION,
    evaluatorVersion: evaluator.evaluatorVersion,
    generatorVersion: "v1",
    scenarioSeeds: Object.freeze(entries.map((entry) => entry.scenarioId)),
    normalScenarioIds: Object.freeze(normal.map((entry) => entry.scenarioId)),
    adversarialScenarioIds: Object.freeze(adversarial.map((entry) => entry.scenarioId)),
    suite,
    dimensionScorecard,
    qualityReport,
    scenarioResults,
    nextPriorities: Object.freeze([
      Object.freeze({
        priority: 1,
        reason: "Improve root-cause discrimination",
        dimensions: ["ROOT_CAUSE_ACCURACY", "CAUSAL_ACCURACY"],
      }),
      Object.freeze({
        priority: 2,
        reason: "Improve uncertainty and contradiction handling",
        dimensions: ["CONTRADICTION_HANDLING", "UNKNOWN_HANDLING"],
      }),
      Object.freeze({
        priority: 3,
        reason: "Reduce unnecessary automation and preserve controls",
        dimensions: ["UNNECESSARY_AUTOMATION_RATE", "HUMAN_CONTROL_PRESERVATION"],
      }),
    ]),
  });
}

export const E61_BASELINE = runE61Baseline();
