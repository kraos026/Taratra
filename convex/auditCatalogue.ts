import { ConvexError } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { auditCatalogue } from "./auditCatalogueData";
import { requireOrganization } from "./lib/access";
import { ConvexAuditRepository } from "./lib/auditRepository";
const key = "canonical-operational-audit-v1";

export const install = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("catalogInstallations")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing) {
      if (existing.sourceSha256 !== auditCatalogue.sourceSha256)
        throw new ConvexError({ code: "CATALOGUE_VERSION_CONFLICT", status: 409 });
      return {
        installed: true,
        alreadyInstalled: true,
        sections: existing.sections,
        questions: existing.questions,
      };
    }
    if (
      await ctx.db
        .query("questionnaire_templates")
        .withIndex("by_business_id", (q) => q.eq("id", auditCatalogue.template.id))
        .first()
    )
      throw new ConvexError({ code: "CATALOGUE_ALREADY_EXISTS_WITHOUT_PROVENANCE", status: 409 });
    if (
      await ctx.db
        .query("questionnaire_versions")
        .withIndex("by_business_id", (q) => q.eq("id", auditCatalogue.version.id))
        .first()
    )
      throw new ConvexError({ code: "CATALOGUE_IDENTIFIER_CONFLICT", status: 409 });
    for (const section of auditCatalogue.sections) {
      if (
        await ctx.db
          .query("questionnaire_sections")
          .withIndex("by_business_id", (q) => q.eq("id", section.id))
          .first()
      )
        throw new ConvexError({ code: "CATALOGUE_IDENTIFIER_CONFLICT", status: 409 });
      for (const question of section.questions)
        if (
          await ctx.db
            .query("questionnaire_questions")
            .withIndex("by_business_id", (q) => q.eq("id", question.id))
            .first()
        )
          throw new ConvexError({ code: "CATALOGUE_IDENTIFIER_CONFLICT", status: 409 });
    }
    const now = new Date().toISOString();
    const template = auditCatalogue.template,
      version = auditCatalogue.version;
    await ctx.db.insert("questionnaire_templates", {
      legacyKey: JSON.stringify([template.id]),
      ...template,
      organizationId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    await ctx.db.insert("questionnaire_versions", {
      legacyKey: JSON.stringify([version.id]),
      id: version.id,
      questionnaireTemplateId: template.id,
      versionNumber: version.versionNumber,
      status: "published",
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    let questions = 0;
    for (const section of auditCatalogue.sections) {
      await ctx.db.insert("questionnaire_sections", {
        legacyKey: JSON.stringify([section.id]),
        id: section.id,
        questionnaireVersionId: version.id,
        title: section.title,
        description: null,
        position: section.position,
        createdAt: now,
        updatedAt: now,
      });
      for (const question of section.questions) {
        await ctx.db.insert("questionnaire_questions", {
          legacyKey: JSON.stringify([question.id]),
          id: question.id,
          questionnaireSectionId: section.id,
          code: question.code,
          label: question.label,
          description: null,
          questionType: question.questionType,
          required: question.required,
          position: question.position,
          optionsJson: question.optionsJson,
          validationJson: question.validationJson,
          metadataJson: {},
          createdAt: now,
          updatedAt: now,
        });
        questions++;
      }
    }
    await ctx.db.insert("catalogInstallations", {
      key,
      sourceSha256: auditCatalogue.sourceSha256,
      templateId: template.id,
      versionId: version.id,
      sections: auditCatalogue.sections.length,
      questions,
      installedAt: now,
    });
    return {
      installed: true,
      alreadyInstalled: false,
      sections: auditCatalogue.sections.length,
      questions,
    };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const scope = await requireOrganization(ctx),
      repository = new ConvexAuditRepository(ctx, scope);
    const templates = await ctx.db.query("questionnaire_templates").take(501);
    if (templates.length > 500)
      throw new ConvexError({ code: "PILOT_CAPACITY_LIMIT", status: 409 });
    const items = [];
    for (const template of templates.filter(
      (template) =>
        template.deletedAt === null &&
        (template.isSystem || template.organizationId === scope.organizationId),
    )) {
      const versions = await ctx.db
        .query("questionnaire_versions")
        .withIndex("by_questionnaireTemplateId_versionNumber", (q) =>
          q.eq("questionnaireTemplateId", template.id),
        )
        .take(101);
      if (versions.length > 100)
        throw new ConvexError({ code: "PILOT_CAPACITY_LIMIT", status: 409 });
      for (const version of versions.filter((version) => version.status === "published")) {
        const sections = await repository.versionSections(version.id);
        if (sections.length && sections.some((section) => section.questions.length))
          items.push({
            templateId: template.id,
            versionId: version.id,
            name: template.name,
            versionNumber: version.versionNumber,
            sections: sections.length,
            questions: sections.reduce((count, section) => count + section.questions.length, 0),
          });
      }
    }
    return items.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  },
});
