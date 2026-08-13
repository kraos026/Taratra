import { describe, expect, it } from "vitest";
import {
  SyntheticBrainAdapter,
  SyntheticEnterpriseGenerator,
  createScenarioLibrary,
  createAdversarialScenarioLibrary,
  toScenarioDataset,
  type SyntheticScenarioProfile,
} from "./synthetic-enterprise-lab";

const profile: SyntheticScenarioProfile = {
  sector: "cross-sector",
  companySize: "SMB",
  processComplexity: 0.5,
  dataQuality: 0.8,
  automationMaturity: 0.3,
  systemFragmentation: 0.6,
  humanDependency: 0.5,
  exceptionRate: 0.1,
  controlIntensity: 0.5,
  documentationQuality: 0.6,
  organizationalMaturity: 0.6,
  riskLevel: 0.3,
  category: "HIGH_VALUE_AUTOMATION",
};
describe("Synthetic Enterprise Lab", () => {
  it("generates deterministically", () => {
    const g = new SyntheticEnterpriseGenerator();
    expect(g.generate("seed-1", "v1", profile)).toEqual(g.generate("seed-1", "v1", profile));
  });
  it("varies with seed without global randomness", () => {
    const g = new SyntheticEnterpriseGenerator();
    expect(g.generate("seed-1", "v1", profile).actors).not.toEqual(
      g.generate("seed-2", "v1", profile).actors,
    );
  });
  it("hides GroundTruth from public view", () => {
    const g = new SyntheticEnterpriseGenerator();
    const view = g.view(g.generate("seed", "v1", profile));
    expect(view).not.toHaveProperty("_groundTruth");
    expect(JSON.stringify(view)).not.toContain("trueRootCause");
  });
  it("keeps truth available only for evaluation object", () => {
    const e = new SyntheticEnterpriseGenerator().generate("seed", "v1", profile);
    expect(e._groundTruth.trueRootCause).toBeDefined();
  });
  it("generates contradictory interviews", () => {
    const e = new SyntheticEnterpriseGenerator().generate("conflict", "v1", {
      ...profile,
      category: "CONTRADICTORY",
    });
    expect(e.interviews.some((i) => i.status === "CONTRADICTORY")).toBe(true);
  });
  it("generates objective metric evidence", () => {
    const e = new SyntheticEnterpriseGenerator().generate("seed", "v1", profile);
    expect(e.metrics.find((m) => m.name === "orders/day")?.value).toBe(62);
  });
  it("supports hidden root cause scenarios", () => {
    const e = new SyntheticEnterpriseGenerator().generate("bad-data", "v1", {
      ...profile,
      dataQuality: 0.3,
      category: "DATA_QUALITY_FAILURE",
    });
    expect(e._groundTruth.trueRootCause).toBe("poor-master-data");
  });
  it("preserves mandatory human controls", () => {
    const e = new SyntheticEnterpriseGenerator().generate("approval", "v1", {
      ...profile,
      controlIntensity: 0.9,
      category: "HUMAN_CONTROL_REQUIRED",
    });
    expect(e._groundTruth.expectedHumanControl).toBe(true);
  });
  it("exposes only observable evidence through adapter", () => {
    const e = new SyntheticEnterpriseGenerator().generate("seed", "v1", profile);
    const evidence = new SyntheticBrainAdapter().toEvidence(
      new SyntheticEnterpriseGenerator().view(e),
    );
    expect(evidence[0]).not.toHaveProperty("trueMetric");
    expect(evidence[0]?.provenance.synthetic).toBe(true);
  });
  it("provides the requested scenario library", () => {
    expect(createScenarioLibrary()).toHaveLength(12);
  });
  it("keeps scenario categories explicit", () => {
    expect(createScenarioLibrary().every((s) => typeof s.profile.category === "string")).toBe(true);
  });
  it("does not expose forbidden recommendations publicly", () => {
    const e = new SyntheticEnterpriseGenerator().generate("seed", "v1", profile);
    expect(new SyntheticEnterpriseGenerator().view(e)).not.toHaveProperty(
      "forbiddenRecommendations",
    );
  });
  it("preserves generator version", () => {
    expect(
      new SyntheticEnterpriseGenerator().generate("seed", "v2", profile).generatorVersion,
    ).toBe("v2");
  });
  it("uses no production persistence contract", () => {
    const e = new SyntheticEnterpriseGenerator().generate("seed", "v1", profile);
    expect(e).not.toHaveProperty("repository");
  });
  it("exports a public dataset without exposing evaluation truth", () => {
    const generator = new SyntheticEnterpriseGenerator();
    const dataset = toScenarioDataset(generator, "sample", "seed", "v1", profile);
    expect(dataset.publicView).not.toHaveProperty("_groundTruth");
    expect(dataset.groundTruthReference).toContain("synthetic-ground-truth");
    expect(dataset.evaluationExpectations.expectedDecisionClass).toBe("QUALIFY");
  });
  it("provides four adversarial datasets", () => {
    expect(createAdversarialScenarioLibrary()).toHaveLength(4);
  });
});
