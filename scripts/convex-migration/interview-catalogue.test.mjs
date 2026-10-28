import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseInterviewCatalogue } from "./interview-catalogue.mjs";
import { interviewCatalogue } from "../../convex/interviewCatalogueData";
describe("Adaptive interview catalogue", () => {
  it("preserves the existing conditions, weights and prompts", () => {
    const parsed = parseInterviewCatalogue(
      readFileSync(
        new URL(
          "../../supabase/migrations/20260726042817_add_adaptive_interview_engine.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect(parsed).toEqual(interviewCatalogue);
    expect(parsed.questions).toHaveLength(20);
    expect(
      parsed.questions.find((question) => question.code === "finance.invoice_volume").conditionJson,
    ).toEqual({ fact: "answer.finance.invoices_email", operator: "equal", value: true });
    expect(new Set(parsed.questions.map((question) => question.id)).size).toBe(20);
  });
});
