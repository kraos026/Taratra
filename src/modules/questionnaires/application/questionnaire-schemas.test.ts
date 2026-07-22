import { describe, expect, it } from "vitest";
import {
  questionInputSchema,
  questionnaireInputSchema,
  questionnaireListSchema,
} from "./questionnaire-schemas";
describe("questionnaire schemas", () => {
  it("trims questionnaire input", () =>
    expect(questionnaireInputSchema.parse({ name: "  Audit  ", category: " ops " })).toMatchObject({
      name: "Audit",
      category: "ops",
    }));
  it("requires options for choice questions", () =>
    expect(
      questionInputSchema.safeParse({
        code: "choice.code",
        label: "Choice",
        questionType: "single_choice",
        position: 1,
        validationJson: {},
        metadataJson: {},
      }).success,
    ).toBe(false));
  it("rejects options for text questions", () =>
    expect(
      questionInputSchema.safeParse({
        code: "text.code",
        label: "Text",
        questionType: "short_text",
        position: 1,
        optionsJson: ["x"],
        validationJson: {},
        metadataJson: {},
      }).success,
    ).toBe(false));
  it("bounds pagination and whitelists sorting", () => {
    expect(questionnaireListSchema.safeParse({ pageSize: 101 }).success).toBe(false);
    expect(questionnaireListSchema.safeParse({ sortBy: "organizationId" }).success).toBe(false);
  });
});
