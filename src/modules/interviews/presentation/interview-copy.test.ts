import { describe, expect, it } from "vitest";
import {
  interviewAnswerLabel,
  interviewChoiceLabel,
  interviewErrorLabel,
  interviewDomainLabel,
  isInterviewReadOnly,
  interviewReviewSummary,
  interviewConfidenceLabel,
} from "./interview-copy";

describe("Interview presentation", () => {
  it("keeps uncertainty visible even when the server allows progression", () => {
    const summary = interviewReviewSummary(
      [
        { id: "hr", code: "hr.lifecycle" },
        { id: "time", code: "finance.time" },
      ],
      [
        { questionId: "hr", value: "À confirmer", confidence: "uncertain" },
        { questionId: "time", value: null, confidence: "missing" },
      ],
      { missingMandatory: [], readyForProcessMapping: true },
    );
    expect(summary.pendingCount).toBe(2);
    expect(summary.message).toContain("ne garantit pas");
  });

  it("counts missing required answers once and excludes ineligible saved answers", () => {
    const summary = interviewReviewSummary(
      [{ id: "required", code: "required" }],
      [
        { questionId: "required", value: null, confidence: "missing" },
        { questionId: "ineligible", value: "Ancienne réponse", confidence: "uncertain" },
      ],
      { missingMandatory: ["required"], readyForProcessMapping: false },
    );
    expect(summary.pendingCount).toBe(1);
    expect(summary.message).toContain("restent à renseigner");
    expect(
      interviewReviewSummary([{ id: "required", code: "required" }], [], {
        missingMandatory: ["required"],
        readyForProcessMapping: false,
      }).pendingCount,
    ).toBe(1);
  });

  it("explains a confidence blocker without inventing missing required answers", () => {
    expect(
      interviewReviewSummary([], [], {
        missingMandatory: [],
        readyForProcessMapping: false,
      }).message,
    ).toContain("seuil de confiance");
  });

  it("never presents a missing, uncertain or unknown status as confirmed", () => {
    expect(interviewConfidenceLabel(false, "confirmed")).toBe("Réponse déclarée confirmée");
    expect(interviewConfidenceLabel(0, "validated")).toBe("Réponse validée");
    expect(interviewConfidenceLabel(null, "confirmed")).toBe("Information non renseignée");
    for (const status of ["uncertain", "unexpected"])
      expect(interviewConfidenceLabel("À vérifier", status)).toContain("incertaine");
  });
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
