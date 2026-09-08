import { describe, expect, it } from "vitest";
import { interviewAnswerLabel, interviewDomainLabel, isInterviewReadOnly } from "./interview-copy";

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
    expect([true, false, null, 0, "email"].map(interviewAnswerLabel)).toEqual([
      "Oui",
      "Non",
      "Sans réponse",
      "0",
      "email",
    ]);
  });
});
