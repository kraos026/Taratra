import { describe, expect, it } from "vitest";
import { RoiEvaluationEngine, type AssumptionCode, type RoiInput } from "./roi-engine";
const codes: AssumptionCode[] = [
  "hourly_cost",
  "working_days",
  "working_hours",
  "monthly_frequency",
  "annual_frequency",
  "hours_saved_per_occurrence",
  "implementation_cost",
  "maintenance_cost",
  "training_cost",
  "infrastructure_cost",
  "error_cost",
];
const input = (): RoiInput => ({
  automationSnapshotId: "automation",
  automationStatus: "published",
  aiSnapshotId: "ai",
  aiStatus: "published",
  analysisId: "analysis",
  analysisStatus: "published",
  processMapId: "process",
  processMapStatus: "published",
  knowledgeSnapshotId: "knowledge",
  currency: "EUR",
  suppliedAssumptions: {
    hourly_cost: 50,
    working_days: 220,
    working_hours: 8,
    monthly_frequency: 10,
    annual_frequency: 100,
    hours_saved_per_occurrence: 2,
    implementation_cost: 1000,
    maintenance_cost: 300,
    training_cost: 100,
    infrastructure_cost: 200,
    error_cost: 10,
  },
  unknownAssumptions: [],
  opportunities: [
    {
      id: "opportunity",
      identifier: "invoice",
      title: "Invoice automation",
      description: "Automate invoices",
      automationCoverage: 80,
      confidence: 80,
      evidence: [{ id: "evidence", businessFindingId: "finding", knowledgeFactId: "fact" }],
      aiOpportunityIds: ["ai-opportunity"],
    },
  ],
  models: [
    {
      id: "model",
      code: "automation_economic_impact",
      version: 1,
      formula: { type: "documented" },
      requiredInputs: codes,
      outputs: [],
    },
  ],
  assumptions: codes.map((code) => ({
    id: code,
    code,
    version: 1,
    unit: "unit",
    defaultValue: null,
    required: true,
  })),
});
describe("RoiEvaluationEngine", () => {
  const engine = new RoiEvaluationEngine();
  it("calculates all deterministic scenarios and metrics", () => {
    const result = engine.evaluate(input());
    expect(result.scenarios.map((item) => item.type)).toEqual([
      "conservative",
      "expected",
      "optimistic",
    ]);
    const expected = result.scenarios[1]!.evaluations[0]!;
    expect(expected.metrics).toHaveLength(13);
    expect(expected.metrics.find((item) => item.code === "annual_hours_saved")?.value).toBe(160);
    expect(expected.metrics.find((item) => item.code === "annual_cost_saved")?.value).toBe(8000);
    expect(expected.metrics.find((item) => item.code === "roi_percentage")?.value).toBeCloseTo(
      553.8462,
    );
  });
  it("freezes validated scenario factors", () => {
    const result = engine.evaluate(input());
    expect(result.scenarios.map((item) => [item.type, item.volumeFactor, item.costFactor])).toEqual(
      [
        ["conservative", 0.75, 1.2],
        ["expected", 1, 1],
        ["optimistic", 1.25, 0.9],
      ],
    );
  });
  it("serializes zero-cost positive ROI as unbounded", () => {
    const value = input();
    value.suppliedAssumptions.implementation_cost = 0;
    value.suppliedAssumptions.training_cost = 0;
    value.suppliedAssumptions.infrastructure_cost = 0;
    const metric = engine
      .evaluate(value)
      .scenarios[1]!.evaluations[0]!.metrics.find((item) => item.code === "roi_percentage");
    expect(metric).toMatchObject({ value: null, specialValue: "unbounded" });
  });
  it("reports missing assumptions and unpublished sources", () => {
    const value = input();
    delete value.suppliedAssumptions.hourly_cost;
    value.automationStatus = "draft";
    expect(engine.evaluate(value).validations.map((item) => item.code)).toEqual([
      "automation_not_published",
      "unknown_assumption",
    ]);
  });
  it("keeps an explicitly unknown assumption unknown even when a catalog default exists", () => {
    const value = input();
    value.assumptions.find((item) => item.code === "maintenance_cost")!.defaultValue = 250;
    value.unknownAssumptions = ["maintenance_cost"];
    const result = engine.evaluate(value);
    expect(result.scenarios).toEqual([]);
    expect(result.validations).toContainEqual(
      expect.objectContaining({ code: "unknown_assumption" }),
    );
  });
  it("distinguishes known zero from unknown", () => {
    const known = input();
    known.suppliedAssumptions.maintenance_cost = 0;
    expect(engine.evaluate(known).scenarios).toHaveLength(3);
    const unknown = input();
    unknown.unknownAssumptions = ["maintenance_cost"];
    expect(engine.evaluate(unknown).scenarios).toEqual([]);
  });
  it("rebuild remains deterministic", () =>
    expect(engine.rebuild(input())).toEqual(engine.evaluate(input())));
});
