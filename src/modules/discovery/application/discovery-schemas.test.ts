import { describe, expect, it } from "vitest";
import { discoveryAutosaveSchema, discoveryPayloadSchema } from "./discovery-schemas";
describe("Discovery schemas", () => {
  it("validates a company step", () =>
    expect(
      discoveryPayloadSchema.safeParse({
        step: "company",
        industry: "Services",
        countryCode: "fr",
        employeeCount: 12,
        description: null,
      }).success,
    ).toBe(true));
  it("requires paired revenue amount and currency", () =>
    expect(
      discoveryPayloadSchema.safeParse({
        step: "business",
        businessModel: "B2B",
        growthStage: "growth",
        revenueAmount: 10,
        revenueCurrency: null,
        revenueYear: 2026,
        offerings: [],
        objectives: [],
        challenges: [],
      }).success,
    ).toBe(false));
  it("validates bounded process data", () =>
    expect(
      discoveryPayloadSchema.safeParse({
        step: "processes",
        items: [
          {
            name: "Facturation",
            categoryCode: "finance",
            description: null,
            frequency: "monthly",
            volume: 12,
            manualHoursMonth: 5,
            painPoints: ["Double saisie"],
          },
        ],
      }).success,
    ).toBe(true));
  it("requires optimistic lock version", () =>
    expect(
      discoveryAutosaveSchema.safeParse({
        lockVersion: 0,
        payload: { step: "review", confirmed: true },
      }).success,
    ).toBe(false));
});
