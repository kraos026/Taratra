import { describe, expect, it } from "vitest";
import {
  interviewAnswerLabel,
  interviewChoiceLabel,
  interviewErrorLabel,
  interviewDomainLabel,
  isInterviewReadOnly,
} from "./interview-copy";

describe("Interview presentation", () => {
  it("uses business labels without exposing technical domain codes", () => {
    expect(
      ["company", "operations", "finance", "software", "hr"].map(interviewDomainLabel),
    ).toEqual(["Entreprise", "Activité", "Finances", "Outils", "Équipe"]);
  });
  it("preserves editing before validation but protects the validated review", () => {
    for (const status of ["draft", "in_progress", "completed"])
      expect(isInterviewReadOnly(status)).toBe(false);
    for (const status of ["validated", "archived"]) expect(isInterviewReadOnly(status)).toBe(true);
  });
  it("displays boolean and missing answers naturally without rewriting saved text", () => {
    expect([true, false, null, 0, "email"].map((value) => interviewAnswerLabel(value))).toEqual([
      "Oui",
      "Non",
      "Sans réponse",
      "0",
      "email",
    ]);
  });
  it("labels canonical choices without translating free text or unrelated questions", () => {
    expect(
      ["manual", "mixed", "automatic"].map((value) =>
        interviewChoiceLabel("finance.invoice_mode", value),
      ),
    ).toEqual(["Manuel", "Partiellement automatisé", "Automatique"]);
    expect(
      interviewAnswerLabel(["email", "website"], {
        code: "operations.order_channels",
        answerType: "multiple_choice",
      }),
    ).toBe("E-mail, Site internet");
    expect(
      interviewAnswerLabel("manual", {
        code: "finance.invoice_mode",
        answerType: "single_choice",
      }),
    ).toBe("Manuel");
    expect(
      interviewAnswerLabel("manual", {
        code: "finance.invoice_mode",
        answerType: "short_text",
      }),
    ).toBe("manual");
    expect(interviewChoiceLabel("other.question", "manual")).toBe("manual");
    expect(interviewChoiceLabel("finance.invoice_mode", "future_choice")).toBe("future_choice");
  });
  it("explains the Discovery prerequisite without changing other server errors", () => {
    for (const action of ["start", "view"])
      expect(
        interviewErrorLabel(`A validated Discovery is required to ${action} an interview`),
      ).toContain("Validez d’abord");
    expect(interviewErrorLabel("Autre erreur")).toBe("Autre erreur");
  });
});
