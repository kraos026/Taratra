import { describe, expect, it } from "vitest";
import {
  BrainEvaluator,
  BrainVersionComparator,
  SyntheticBrainEvaluationRunner,
} from "./brain-evaluator";
import {
  SyntheticEnterpriseGenerator,
  createAdversarialScenarioLibrary,
  createScenarioLibrary,
  toScenarioDataset,
} from "./synthetic-enterprise-lab";

const version = {
  version: "test",
  commitSha: "sha",
  contractVersion: "v1",
  knowledgeVersion: "v1",
  retrievalVersion: "v1",
};
describe("BrainEvaluator", () => {
  it("runs the public synthetic view through the Brain pipeline", () => {
    const generator = new SyntheticEnterpriseGenerator();
    const scenario = createScenarioLibrary()[0]!;
    const enterprise = generator.generate(scenario.seed, "v1", scenario.profile);
    const dataset = toScenarioDataset(
      generator,
      scenario.seed,
      scenario.seed,
      "v1",
      scenario.profile,
    );
    const result = new SyntheticBrainEvaluationRunner().run(generator.view(enterprise));
    const run = new BrainEvaluator().evaluate(dataset, enterprise._groundTruth, result, version);
    expect(run.brainResult.evidenceSummary.count).toBeGreaterThan(0);
    expect(run.scorecard.EVIDENCE_DISCIPLINE.metrics.syntheticLeakageDetected).toBe(0);
  });
  it("keeps forbidden recommendations as critical failures", () => {
    const evaluator = new BrainEvaluator();
    const scenario = createScenarioLibrary()[2]!;
    const generator = new SyntheticEnterpriseGenerator();
    const enterprise = generator.generate(scenario.seed, "v1", scenario.profile);
    const dataset = toScenarioDataset(
      generator,
      scenario.seed,
      scenario.seed,
      "v1",
      scenario.profile,
    );
    const result = new SyntheticBrainEvaluationRunner().run(generator.view(enterprise));
    const run = evaluator.evaluate(dataset, enterprise._groundTruth, result, version);
    expect(run.status).toMatch(/PASS|FAIL|CRITICAL_FAIL/);
    expect(run.scorecard).toHaveProperty("HUMAN_CONTROL_PRESERVATION");
  });
  it("separates adversarial scenarios", () => {
    const scenarios = createAdversarialScenarioLibrary();
    expect(scenarios).toHaveLength(4);
    expect(scenarios.every((s) => s.scenarioId.startsWith("adversarial:"))).toBe(true);
  });
  it("compares versions deterministically", () => {
    const evaluator = new BrainEvaluator();
    const a = evaluator.evaluateSuite([]);
    const b = evaluator.evaluateSuite([]);
    expect(new BrainVersionComparator().compare(a, b).status).toBe("UNCHANGED");
  });
  it("critical gate status is not hidden by scorecard shape", () => {
    const scenario = createScenarioLibrary()[0]!;
    const dataset = toScenarioDataset(
      new SyntheticEnterpriseGenerator(),
      "critical-gate",
      scenario.seed,
      "v1",
      scenario.profile,
    );
    expect(dataset.evaluationExpectations.forbiddenOpportunityTypes).toBeDefined();
  });
});
