/// <reference types="vite/client" />
import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api, internal } from "../../../convex/_generated/api";
import { auditCatalogue } from "../../../convex/auditCatalogueData";
const modules = import.meta.glob("../../../convex/**/*.ts");
afterEach(() => vi.unstubAllEnvs());
const versionId = auditCatalogue.version.id;
function valueFor(
  question: (typeof auditCatalogue.sections)[number]["questions"][number],
): unknown {
  switch (question.questionType) {
    case "boolean":
      return false;
    case "single_choice":
      return question.optionsJson?.[0];
    case "multiple_choice":
      return question.optionsJson ? [question.optionsJson[0]] : [];
    case "date":
      return "2026-10-28";
    case "number":
    case "currency":
    case "percentage":
      return 12;
    default:
      return "Description réelle du processus de notre entreprise.";
  }
}
async function setup() {
  vi.stubEnv("OPTIVOS_CONVEX_FRESH_PILOT", "1");
  const t = convexTest(schema, modules),
    owner = t.withIdentity({ subject: "audit-owner" }),
    other = t.withIdentity({ subject: "audit-other" });
  const org = await owner.mutation(api.workspaces.create, { name: "Audit owner organization" });
  await other.mutation(api.workspaces.create, { name: "Other organization" });
  await t.mutation(internal.auditCatalogue.install, {});
  const company = await owner.mutation(api.companies.create, {
    input: { name: "Company under audit" },
  });
  const foreignCompany = await other.mutation(api.companies.create, {
    input: { name: "Other private company" },
  });
  const audit = await owner.mutation(api.audits.create, {
    companyId: company.id,
    questionnaireVersionId: versionId,
  });
  return { t, owner, other, company, foreignCompany, audit, org };
}
describe("Convex canonical audit lifecycle", () => {
  it("installs only the canonical catalogue once and protects its reads", async () => {
    const { t, owner } = await setup();
    expect(await t.mutation(internal.auditCatalogue.install, {})).toMatchObject({
      alreadyInstalled: true,
      sections: 10,
      questions: 24,
    });
    expect(await owner.query(api.auditCatalogue.list, {})).toEqual([
      expect.objectContaining({ versionId, sections: 10, questions: 24 }),
    ]);
    expect(await t.run((ctx) => ctx.db.query("audit_answers").collect())).toEqual([]);
    expect(
      await t.run(async (ctx) => (await ctx.db.query("questionnaire_questions").collect()).length),
    ).toBe(24);
    await expect(t.query(api.auditCatalogue.list, {})).rejects.toThrow("UNAUTHENTICATED");
  });
  it("validates answers, persists one response per question and preserves canonical progress", async () => {
    const { owner, audit, t } = await setup();
    const q = auditCatalogue.sections[1].questions.find(
      (question) => question.code === "admin.hours",
    )!;
    await expect(
      owner.mutation(api.audits.answer, { id: audit.id, questionId: q.id, value: -1 }),
    ).rejects.toThrow("INVALID_ANSWER");
    expect((await owner.query(api.audits.get, { id: audit.id })).item.answers).toHaveLength(0);
    expect(
      await owner.mutation(api.audits.answer, { id: audit.id, questionId: q.id, value: 10 }),
    ).toMatchObject({ status: "in_progress", progressPercentage: 4 });
    await owner.mutation(api.audits.answer, { id: audit.id, questionId: q.id, value: 20 });
    const detail = await owner.query(api.audits.get, { id: audit.id });
    expect(detail.item.answers).toHaveLength(1);
    expect(detail.item.answers[0].valueJson).toBe(20);
    expect(detail.item).not.toHaveProperty("_id");
    expect(detail.item.questionnaireVersion?.sections[0]).not.toHaveProperty("legacyKey");
    expect(await t.run(async (ctx) => (await ctx.db.query("audit_answers").collect()).length)).toBe(
      1,
    );
  });
  it("requires mandatory answers, completes, validates, locks and archives an actual audit", async () => {
    const { owner, audit } = await setup();
    await expect(owner.mutation(api.audits.complete, { id: audit.id })).rejects.toThrow(
      "AUDIT_INCOMPLETE",
    );
    for (const q of auditCatalogue.sections.flatMap((section) => [...section.questions]))
      await owner.mutation(api.audits.answer, {
        id: audit.id,
        questionId: q.id,
        value: valueFor(q),
      });
    expect(await owner.mutation(api.audits.complete, { id: audit.id })).toMatchObject({
      status: "completed",
      progressPercentage: 100,
    });
    expect(await owner.mutation(api.audits.validate, { id: audit.id })).toMatchObject({
      status: "validated",
    });
    const q = auditCatalogue.sections[0].questions[0];
    await expect(
      owner.mutation(api.audits.answer, {
        id: audit.id,
        questionId: q.id,
        value: "Forbidden rewrite",
      }),
    ).rejects.toThrow("AUDIT_INVALID_STATE");
    await expect(owner.mutation(api.audits.complete, { id: audit.id })).rejects.toThrow(
      "AUDIT_INVALID_STATE",
    );
    await expect(
      owner.mutation(api.audits.update, { id: audit.id, currentSectionId: null }),
    ).rejects.toThrow("AUDIT_INVALID_STATE");
    await owner.mutation(api.audits.archive, { id: audit.id });
    expect((await owner.query(api.audits.list, {})).items).toEqual([]);
    await expect(owner.query(api.audits.get, { id: audit.id })).rejects.toThrow("AUDIT_NOT_FOUND");
  });
  it("rejects cross-tenant reads, writes and company references", async () => {
    const { owner, other, foreignCompany, audit } = await setup();
    expect((await other.query(api.audits.list, {})).total).toBe(0);
    await expect(other.query(api.audits.get, { id: audit.id })).rejects.toThrow("AUDIT_NOT_FOUND");
    await expect(
      other.mutation(api.audits.answer, {
        id: audit.id,
        questionId: auditCatalogue.sections[0].questions[0].id,
        value: "Forged answer",
      }),
    ).rejects.toThrow("AUDIT_NOT_FOUND");
    await expect(
      owner.mutation(api.audits.create, {
        companyId: foreignCompany.id,
        questionnaireVersionId: versionId,
      }),
    ).rejects.toThrow("AUDIT_NOT_FOUND");
    await expect(other.mutation(api.audits.archive, { id: audit.id })).rejects.toThrow(
      "AUDIT_NOT_FOUND",
    );
  });
  it("enforces viewer and consultant roles and rejects untrusted question/section identifiers", async () => {
    const { owner, t, audit, org } = await setup();
    const unrelated = "99999999-0000-4000-8000-000000000001";
    await expect(
      owner.mutation(api.audits.answer, { id: audit.id, questionId: unrelated, value: 5 }),
    ).rejects.toThrow("AUDIT_NOT_FOUND");
    await expect(
      owner.mutation(api.audits.update, { id: audit.id, currentSectionId: unrelated }),
    ).rejects.toThrow("AUDIT_SECTION_MISMATCH");
    const membership = await t.run((ctx) =>
      ctx.db
        .query("organization_members")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", org.organizationId))
        .unique(),
    );
    await t.run((ctx) => ctx.db.patch(membership!._id, { role: "viewer" }));
    expect((await owner.query(api.audits.get, { id: audit.id })).permissions.canWrite).toBe(false);
    await expect(
      owner.mutation(api.audits.answer, {
        id: audit.id,
        questionId: auditCatalogue.sections[0].questions[0].id,
        value: "Viewer",
      }),
    ).rejects.toThrow("AUDIT_FORBIDDEN");
    await expect(owner.mutation(api.audits.complete, { id: audit.id })).rejects.toThrow(
      "AUDIT_FORBIDDEN",
    );
    await t.run((ctx) => ctx.db.patch(membership!._id, { role: "consultant" }));
    await expect(owner.mutation(api.audits.validate, { id: audit.id })).rejects.toThrow(
      "AUDIT_FORBIDDEN",
    );
  });
  it("rejects unpublished questionnaires and preserves answers when related data becomes unavailable", async () => {
    const { t, owner, audit, company } = await setup();
    const version = await t.run((ctx) =>
      ctx.db
        .query("questionnaire_versions")
        .withIndex("by_business_id", (q) => q.eq("id", versionId))
        .unique(),
    );
    await t.run((ctx) => ctx.db.patch(version!._id, { status: "draft", publishedAt: null }));
    await expect(
      owner.mutation(api.audits.create, {
        companyId: company.id,
        questionnaireVersionId: versionId,
      }),
    ).rejects.toThrow("AUDIT_NOT_FOUND");
    await expect(
      owner.mutation(api.audits.answer, {
        id: audit.id,
        questionId: auditCatalogue.sections[0].questions[0].id,
        value: "Our company process",
      }),
    ).rejects.toThrow("AUDIT_INVALID_STATE");
    expect((await owner.query(api.audits.get, { id: audit.id })).item.answers).toHaveLength(0);
  });
  it("rejects existing questions from another version and another organization's private catalogue", async () => {
    const { t, owner, other, audit, company } = await setup();
    const otherOrg = (await other.query(api.workspaces.current, {}))!;
    const foreignVersion = "90000000-0000-4000-8000-000000000002";
    const foreignSection = "90000000-0000-4000-8000-000000000003";
    const foreignQuestion = "90000000-0000-4000-8000-000000000004";
    await t.run(async (ctx) => {
      const now = new Date().toISOString(),
        templateId = "90000000-0000-4000-8000-000000000001";
      await ctx.db.insert("questionnaire_templates", {
        legacyKey: JSON.stringify([templateId]),
        id: templateId,
        organizationId: otherOrg.organizationId,
        name: "Private template B",
        description: null,
        category: "automation",
        isSystem: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
      await ctx.db.insert("questionnaire_versions", {
        legacyKey: JSON.stringify([foreignVersion]),
        id: foreignVersion,
        questionnaireTemplateId: templateId,
        versionNumber: 1,
        status: "published",
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("questionnaire_sections", {
        legacyKey: JSON.stringify([foreignSection]),
        id: foreignSection,
        questionnaireVersionId: foreignVersion,
        title: "Private section",
        description: null,
        position: 1,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("questionnaire_questions", {
        legacyKey: JSON.stringify([foreignQuestion]),
        id: foreignQuestion,
        questionnaireSectionId: foreignSection,
        code: "private.question",
        label: "Private question",
        description: null,
        questionType: "number",
        required: true,
        position: 1,
        optionsJson: null,
        validationJson: {},
        metadataJson: {},
        createdAt: now,
        updatedAt: now,
      });
    });
    expect(
      (await owner.query(api.auditCatalogue.list, {})).some(
        (catalogue) => catalogue.versionId === foreignVersion,
      ),
    ).toBe(false);
    await expect(
      owner.mutation(api.audits.create, {
        companyId: company.id,
        questionnaireVersionId: foreignVersion,
      }),
    ).rejects.toThrow("AUDIT_NOT_FOUND");
    await expect(
      owner.mutation(api.audits.answer, { id: audit.id, questionId: foreignQuestion, value: 42 }),
    ).rejects.toThrow("AUDIT_NOT_FOUND");
    await expect(
      owner.mutation(api.audits.update, { id: audit.id, currentSectionId: foreignSection }),
    ).rejects.toThrow("AUDIT_SECTION_MISMATCH");
    expect((await owner.query(api.audits.get, { id: audit.id })).item.answers).toEqual([]);
  });
});
