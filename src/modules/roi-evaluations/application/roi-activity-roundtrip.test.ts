import { describe, expect, it } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { RoiEvaluationEngine, type AssumptionCode, type RoiInput } from "../domain/roi-engine";
import {
  prepareRoiPersistencePlan,
  readFrozenAssumptions,
} from "../infrastructure/prisma-roi-evaluation-repository";
import { roiTraces } from "../presentation/roi-trace";
import { normalizeRoiRequest, roiEvaluateSchema } from "./roi-schemas";

const values = {
  hourly_cost: 30,
  working_days: 220,
  working_hours: 8,
  monthly_frequency: 10,
  annual_frequency: 120,
  hours_saved_per_occurrence: 2,
  implementation_cost: 1000,
  maintenance_cost: 0,
  training_cost: 100,
  infrastructure_cost: 200,
  error_cost: 0,
};
const ids = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"];
function fixture(): RoiInput {
  const request = roiEvaluateSchema.parse({
    currency: "EUR",
    assumptions: values,
    activities: ids.map((opportunityId, index) => ({
      opportunityId,
      assumptions: { ...values, annual_frequency: index ? 60 : 120 },
    })),
  });
  return {
    automationSnapshotId: "automation",
    automationStatus: "published",
    aiSnapshotId: "ai",
    aiStatus: "published",
    analysisId: "analysis",
    analysisStatus: "published",
    processMapId: "process",
    processMapStatus: "published",
    knowledgeSnapshotId: "knowledge",
    currency: request.currency,
    ...normalizeRoiRequest(request),
    opportunities: ids.map((id, index) => ({
      id,
      identifier: `activity-${index}`,
      title: `Activité fictive ${index}`,
      description: "Cas synthétique",
      automationCoverage: 80,
      confidence: 80,
      aiOpportunityIds: ["ai"],
      evidence: [
        {
          id: `evidence-${index}`,
          businessFindingId: `finding-${index}`,
          knowledgeFactId: `fact-${index}`,
        },
      ],
    })),
    assumptions: (Object.keys(values) as AssumptionCode[]).map((code) => ({
      id: code,
      code,
      version: 1,
      unit: "unit",
      defaultValue: 999,
      required: true,
    })),
    models: [
      {
        id: "model",
        code: "automation_economic_impact",
        version: 2,
        formula: {},
        requiredInputs: Object.keys(values),
        outputs: [],
      },
    ],
  };
}

describe("ROI activity API to persistence provenance roundtrip (synthetic, no live DB)", () => {
  it("recalculates distinct values from frozen activity inputs without shared inheritance", () => {
    const input = fixture();
    const engine = new RoiEvaluationEngine();
    const result = engine.evaluate(input);
    const expected = result.scenarios.find((row) => row.type === "expected")!;
    expect(
      expected.evaluations.map(
        (row) => row.metrics.find((metric) => metric.code === "annual_hours_saved")!.value,
      ),
    ).toEqual([240, 120]);
    const plan = prepareRoiPersistencePlan("organization", input, result);
    expect(plan.assumptionRows).toEqual([]);
    expect(plan.scenarioRows).toHaveLength(3);
    expect(plan.evaluationRows).toHaveLength(6);
    const frozen = readFrozenAssumptions(
      JSON.parse(JSON.stringify(plan.provenanceJson)) as Prisma.JsonValue,
    )!;
    expect(frozen.activityAssumptions).toEqual(input.activityAssumptions);
    expect(engine.rebuild({ ...input, ...frozen })).toEqual(result);
    const traces = roiTraces({
      scenarios: plan.scenarioRows.map((row) => ({ ...row, id: row.id! })),
      evaluations: plan.evaluationRows.map((row) => ({ ...row, id: row.id! })),
      contributions: plan.contributionRows,
      assumptions: plan.assumptionRows,
      evidence: plan.evidenceRows,
    });
    expect(
      traces.every(
        (trace) => trace.sharedEvaluationCount === 1 && trace.sourceReferenceCount === 1,
      ),
    ).toBe(true);
    expect(
      traces.every(
        (trace) =>
          trace.assumptions.length === 11 &&
          trace.assumptions.every((item) => item.source === "provided"),
      ),
    ).toBe(true);
  });

  it("retains unknown activity inputs and blocks all aggregate scenarios despite common defaults", () => {
    const input = fixture();
    const activity = input.activityAssumptions![1]!;
    delete activity.suppliedAssumptions.hours_saved_per_occurrence;
    activity.unknownAssumptions.push("hours_saved_per_occurrence");
    const engine = new RoiEvaluationEngine();
    const result = engine.evaluate(input);
    expect(result.scenarios).toEqual([]);
    expect(result.validations.some((row) => row.code === "unknown_assumption")).toBe(true);
    const plan = prepareRoiPersistencePlan("organization", input, result);
    const frozen = readFrozenAssumptions(plan.provenanceJson as Prisma.JsonValue)!;
    expect(frozen.activityAssumptions![1]!.unknownAssumptions).toEqual([
      "hours_saved_per_occurrence",
    ]);
    expect(engine.rebuild({ ...input, ...frozen }).scenarios).toEqual([]);
  });

  it("rejects foreign activity IDs before producing persistence output", () => {
    const input = fixture();
    input.activityAssumptions![1]!.opportunityId = "foreign";
    expect(() => new RoiEvaluationEngine().evaluate(input)).toThrow(
      "match the source opportunities exactly",
    );
  });

  it.each(["duplicate", "negative", "nonfinite", "missing", "foreign-code"])(
    "rejects malformed frozen activity inputs: %s",
    (kind) => {
      const input = fixture();
      const plan = prepareRoiPersistencePlan(
        "organization",
        input,
        new RoiEvaluationEngine().evaluate(input),
      );
      const frozen = JSON.parse(JSON.stringify(plan.provenanceJson));
      const rows = frozen.activityInputs[0].assumptionInputs;
      if (kind === "duplicate") rows.push(rows[0]);
      if (kind === "negative") rows[0].value = -1;
      if (kind === "nonfinite") rows[0].value = Infinity;
      if (kind === "missing") rows.pop();
      if (kind === "foreign-code") rows[0].code = "invented";
      expect(readFrozenAssumptions(frozen)).toBeNull();
    },
  );

  it("rejects incomplete public activity payloads", () => {
    expect(
      roiEvaluateSchema.safeParse({
        currency: "EUR",
        assumptions: values,
        activities: [{ opportunityId: ids[0], assumptions: { hourly_cost: 30 } }],
      }).success,
    ).toBe(false);
  });
});
