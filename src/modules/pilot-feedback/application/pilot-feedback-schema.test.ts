import { describe, expect, it } from "vitest";
import { pilotFeedbackInputSchema } from "./pilot-feedback-schema";

const valid = {
  companyId: "11111111-1111-4111-8111-111111111111",
  understandingScore: 5,
  recommendationRelevanceScore: 4,
  roiCredibilityScore: 3,
  nextStepClarityScore: 4,
  experienceScore: 5,
  willingToPay: "UNSURE",
} as const;

describe("pilotFeedbackInputSchema", () => {
  it("accepts the lightweight feedback payload", () => {
    expect(pilotFeedbackInputSchema.safeParse(valid).success).toBe(true);
  });

  it.each([0, 1.5, 6])("rejects invalid ratings (%s)", (understandingScore) => {
    expect(pilotFeedbackInputSchema.safeParse({ ...valid, understandingScore }).success).toBe(
      false,
    );
  });

  it("rejects invalid commercial and free-text values", () => {
    expect(pilotFeedbackInputSchema.safeParse({ ...valid, willingToPay: "MAYBE" }).success).toBe(
      false,
    );
    expect(
      pilotFeedbackInputSchema.safeParse({ ...valid, acceptablePrice: -1, priceCurrency: "EUR" })
        .success,
    ).toBe(false);
    expect(
      pilotFeedbackInputSchema.safeParse({ ...valid, comment: "x".repeat(2001) }).success,
    ).toBe(false);
  });

  it("requires price and currency together", () => {
    expect(pilotFeedbackInputSchema.safeParse({ ...valid, acceptablePrice: 100 }).success).toBe(
      false,
    );
    expect(pilotFeedbackInputSchema.safeParse({ ...valid, priceCurrency: "EUR" }).success).toBe(
      false,
    );
  });
});
