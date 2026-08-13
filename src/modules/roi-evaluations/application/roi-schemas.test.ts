import { describe, expect, it } from "vitest";
import { normalizeRoiAssumptions, roiEvaluateSchema, roiReviseSchema } from "./roi-schemas";

const numericAssumptions = {
  hourly_cost: 35,
  working_days: 220,
  working_hours: 8,
  monthly_frequency: 10,
  annual_frequency: 120,
  hours_saved_per_occurrence: 2,
  implementation_cost: 1000,
  maintenance_cost: 0,
  training_cost: 100,
  infrastructure_cost: 200,
  error_cost: 5,
};

describe("ROI public assumptions contract", () => {
  it("preserves backward-compatible numeric inputs and known zero", () => {
    const parsed = roiEvaluateSchema.parse({ currency: "EUR", assumptions: numericAssumptions });
    expect(normalizeRoiAssumptions(parsed.assumptions)).toMatchObject({
      suppliedAssumptions: { hourly_cost: 35, maintenance_cost: 0 },
      unknownAssumptions: [],
    });
  });

  it("accepts explicit known and unknown assumptions without defaulting unknown to zero", () => {
    const parsed = roiEvaluateSchema.parse({
      currency: "EUR",
      assumptions: {
        ...numericAssumptions,
        hourly_cost: { status: "known", value: 35 },
        maintenance_cost: { status: "unknown" },
      },
    });
    const normalized = normalizeRoiAssumptions(parsed.assumptions);
    expect(normalized.unknownAssumptions).toEqual(["maintenance_cost"]);
    expect(normalized.suppliedAssumptions.hourly_cost).toBe(35);
    expect(normalized.suppliedAssumptions).not.toHaveProperty("maintenance_cost");
  });

  it.each([
    { status: "known" },
    { status: "known", value: -1 },
    { status: "known", value: Number.NaN },
    { status: "known", value: Number.POSITIVE_INFINITY },
    { status: "unknown", value: 0 },
  ])("rejects malformed assumption %#", (maintenance_cost) => {
    expect(
      roiEvaluateSchema.safeParse({
        currency: "EUR",
        assumptions: { ...numericAssumptions, maintenance_cost },
      }).success,
    ).toBe(false);
  });

  it("keeps currency mandatory and explicit", () => {
    expect(roiEvaluateSchema.safeParse({ assumptions: numericAssumptions }).success).toBe(false);
  });

  it("requires a positive lock version for revision", () => {
    expect(
      roiReviseSchema.safeParse({
        currency: "EUR",
        assumptions: numericAssumptions,
        lockVersion: 1,
      }).success,
    ).toBe(true);
    expect(
      roiReviseSchema.safeParse({ currency: "EUR", assumptions: numericAssumptions }).success,
    ).toBe(false);
    expect(
      roiReviseSchema.safeParse({
        currency: "EUR",
        assumptions: numericAssumptions,
        lockVersion: 0,
      }).success,
    ).toBe(false);
  });
});
