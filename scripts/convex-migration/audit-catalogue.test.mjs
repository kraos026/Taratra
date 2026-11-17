import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseAuditCatalogue } from "./audit-catalogue.mjs";
import { auditCatalogue } from "../../convex/auditCatalogueData";
const source = readFileSync(
  new URL("../../supabase/migrations/20260722064705_add_audit_questionnaire.sql", import.meta.url),
  "utf8",
);
describe("Canonical audit catalogue transfer", () => {
  it("reproduces all source questions and constraints without generating answers", () => {
    const parsed = parseAuditCatalogue(source);
    expect(parsed).toEqual(auditCatalogue);
    expect(parsed.sections).toHaveLength(10);
    const questions = parsed.sections.flatMap((section) => section.questions);
    expect(questions).toHaveLength(24);
    expect(questions.find((question) => question.code === "admin.hours").validationJson).toEqual({
      min: 0,
      max: 500,
    });
    expect(new Set(questions.map((question) => question.id)).size).toBe(24);
    expect(parsed).not.toHaveProperty("answers");
  });
  it("handles SQL string escapes and requires explicit publication", () => {
    const escaped = parseAuditCatalogue(
      source.replace("Audit d’automatisation opérationnelle", "L''audit d''automatisation"),
    );
    expect(escaped.template.name).toBe("L'audit d'automatisation");
    expect(() =>
      parseAuditCatalogue(source.replace("set status = 'published'", "set status = 'draft'")),
    ).toThrow("publication");
  });
});
