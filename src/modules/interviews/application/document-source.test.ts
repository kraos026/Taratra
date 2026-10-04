import { describe, expect, it } from "vitest";
import { documentSourceSchema } from "../domain/document-source";
import { interviewAnswerSchema } from "./interview-schemas";

const source = {
  fileName: "procedure.txt",
  sha256: "a".repeat(64),
  location: "Ligne 2",
  excerpt: "Validation humaine obligatoire.",
  reviewed: true,
};
describe("document provenance contract", () => {
  it("requires explicit review, a hash and bounded excerpt", () => {
    expect(documentSourceSchema.safeParse(source).success).toBe(true);
    for (const change of [
      { reviewed: false },
      { sha256: "invalid" },
      { excerpt: "" },
      { excerpt: "a".repeat(4001) },
      { fileName: "../file.txt" },
      { fileName: "file\n.txt" },
      { tenantId: "other" },
    ])
      expect(documentSourceSchema.safeParse({ ...source, ...change }).success).toBe(false);
  });
  it("preserves ordinary answers and accepts provenance only as optional metadata", () => {
    const answer = {
      lockVersion: 1,
      questionId: "10000000-0000-4000-8000-000000000001",
      value: "Validation humaine.",
      confidence: "uncertain",
    };
    expect(interviewAnswerSchema.safeParse(answer).success).toBe(true);
    expect(interviewAnswerSchema.safeParse({ ...answer, documentSource: source }).success).toBe(
      true,
    );
    expect(
      interviewAnswerSchema.safeParse({ ...answer, documentSource: { ...source, reviewed: false } })
        .success,
    ).toBe(false);
  });
});
