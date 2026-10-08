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
      version: 2,
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
  it("calculates distinct activity inputs with the same canonical formulas without mutating the source", () => {
    const source = input();
    source.opportunities.push({ ...source.opportunities[0]!, id: "email", identifier: "email" });
    const before = JSON.stringify(source);
    const activities = source.opportunities.map((opportunity, index) => ({
      opportunityId: opportunity.id,
      suppliedAssumptions: { ...source.suppliedAssumptions, annual_frequency: index ? 50 : 100 },
      unknownAssumptions: [] as AssumptionCode[],
    }));
    const results = engine.evaluateActivities(source, activities);
    expect(results.map((row) => row.opportunityId)).toEqual(["opportunity", "email"]);
    expect(
      results.map(
        (row) =>
          row.result.scenarios[1]!.evaluations[0]!.metrics.find(
            (metric) => metric.code === "annual_hours_saved",
          )?.value,
      ),
    ).toEqual([200, 100]);
    for (const row of results) {
      const own = activities.find((activity) => activity.opportunityId === row.opportunityId)!;
      expect(row.result).toEqual(
        engine.evaluate({
          ...source,
          opportunities: source.opportunities.filter(
            (opportunity) => opportunity.id === row.opportunityId,
          ),
          suppliedAssumptions: own.suppliedAssumptions,
          unknownAssumptions: own.unknownAssumptions,
          assumptions: source.assumptions.map((definition) => ({
            ...definition,
            defaultValue: null,
          })),
        }),
      );
    }
    expect(JSON.stringify(source)).toBe(before);
  });
  it("keeps unknown activity inputs blocked even when shared inputs and defaults are available", () => {
    const source = input();
    source.assumptions.forEach((definition) => (definition.defaultValue = 100));
    const supplied = { ...source.suppliedAssumptions };
    delete supplied.hours_saved_per_occurrence;
    const [row] = engine.evaluateActivities(source, [
      {
        opportunityId: "opportunity",
        suppliedAssumptions: supplied,
        unknownAssumptions: ["hours_saved_per_occurrence"],
      },
    ]);
    expect(row!.result.scenarios).toEqual([]);
    expect(row!.result.validations).toContainEqual(
      expect.objectContaining({ code: "unknown_assumption" }),
    );
  });
  it.each(["foreign", "duplicate", "missing"])("rejects %s activity references", (kind) => {
    const source = input();
    const own = {
      opportunityId: "opportunity",
      suppliedAssumptions: source.suppliedAssumptions,
      unknownAssumptions: [],
    };
    const activities =
      kind === "foreign"
        ? [{ ...own, opportunityId: "another-tenant" }]
        : kind === "duplicate"
          ? [own, own]
          : [];
    expect(() => engine.evaluateActivities(source, activities)).toThrow(
      "match the source opportunities exactly",
    );
  });
  it.each(["missing", "ambiguous", "foreign-code", "invalid", "duplicate-unknown"])(
    "rejects %s activity assumptions without falling back to shared inputs",
    (kind) => {
      const source = input();
      const activity = {
        opportunityId: "opportunity",
        suppliedAssumptions: { ...source.suppliedAssumptions },
        unknownAssumptions: [] as AssumptionCode[],
      };
      if (kind === "missing") delete activity.suppliedAssumptions.hourly_cost;
      if (kind === "ambiguous") activity.unknownAssumptions.push("hourly_cost");
      if (kind === "foreign-code")
        Object.assign(activity.suppliedAssumptions, { unrecognized: 123 });
      if (kind === "invalid") activity.suppliedAssumptions.hourly_cost = Number.NaN;
      if (kind === "duplicate-unknown") {
        delete activity.suppliedAssumptions.hourly_cost;
        activity.unknownAssumptions.push("hourly_cost", "hourly_cost");
      }
      expect(() => engine.evaluateActivities(source, [activity])).toThrow(
        "complete known or unknown assumptions",
      );
    },
  );
  it("preserves V1 catalog arithmetic and selects the latest published model", () => {
    const value = input();
    value.models[0]!.version = 1;
    expect(engine.evaluate(value).scenarios[1]!.evaluations[0]!.metrics).toContainEqual(
      expect.objectContaining({ code: "annual_hours_saved", value: 160 }),
    );
    value.models.push({ ...value.models[0]!, id: "v2", version: 2 });
    expect(engine.evaluate(value).scenarios[1]!.model.version).toBe(2);
    expect(engine.evaluate(value).scenarios[1]!.evaluations[0]!.metrics).toContainEqual(
      expect.objectContaining({ code: "annual_hours_saved", value: 200 }),
    );
  });
  it("calculates all deterministic scenarios and metrics", () => {
    const result = engine.evaluate(input());
    expect(result.scenarios.map((item) => item.type)).toEqual([
      "conservative",
      "expected",
      "optimistic",
    ]);
    const expected = result.scenarios[1]!.evaluations[0]!;
    expect(expected.metrics).toHaveLength(13);
    expect(expected.metrics.find((item) => item.code === "annual_hours_saved")?.value).toBe(200);
    expect(expected.metrics.find((item) => item.code === "annual_cost_saved")?.value).toBe(10000);
    expect(expected.metrics.find((item) => item.code === "roi_percentage")?.value).toBeCloseTo(
      723.0769,
    );
  });
  it("does not use a finding coverage score as a time-saving percentage", () => {
    const value = input();
    const before = engine.evaluate(value).scenarios[1]!.evaluations[0]!;
    value.opportunities[0]!.automationCoverage = 10;
    expect(engine.evaluate(value).scenarios[1]!.evaluations[0]!.metrics).toEqual(before.metrics);
    expect(before.confidence).toBe(80);
  });
  it("does not turn a known zero annual frequency into monthly activity", () => {
    const value = input();
    value.suppliedAssumptions.annual_frequency = 0;
    expect(engine.evaluate(value).scenarios[1]!.evaluations[0]!.metrics).toContainEqual(
      expect.objectContaining({ code: "annual_hours_saved", value: 0 }),
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

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    "blocks an invalid economic assumption (%s) before producing metrics",
    (invalid) => {
      const value = input();
      value.suppliedAssumptions.hourly_cost = invalid;
      const result = engine.evaluate(value);
      expect(result.scenarios).toEqual([]);
      expect(result.validations.some((item) => item.severity === "error")).toBe(true);
    },
  );
  it("blocks an incomplete assumption catalog instead of publishing NaN metrics", () => {
    const value = input();
    value.assumptions = value.assumptions.filter((item) => item.code !== "hourly_cost");
    const result = engine.evaluate(value);
    expect(result.scenarios).toEqual([]);
    expect(result.validations.some((item) => item.severity === "error")).toBe(true);
  });
  it("blocks arithmetic overflow even for finite positive inputs", () => {
    const value = input();
    value.suppliedAssumptions.hourly_cost = Number.MAX_VALUE;
    const result = engine.evaluate(value);
    expect(result.scenarios).toEqual([]);
    expect(result.validations.some((item) => item.severity === "error")).toBe(true);
  });
  it.each([-1, 101, Number.NaN])("blocks invalid automation coverage (%s)", (coverage) => {
    const value = input();
    value.opportunities[0]!.automationCoverage = coverage;
    const result = engine.evaluate(value);
    expect(result.scenarios).toEqual([]);
    expect(result.validations.some((item) => item.severity === "error")).toBe(true);
  });
});
