import { ConvexError } from "convex/values";
import { internalMutation } from "./_generated/server";
import { interviewCatalogue } from "./interviewCatalogueData";
export const install = internalMutation({
  args: {},
  handler: async (ctx) => {
    const key = "canonical-adaptive-interview-v1";
    const prior = await ctx.db
      .query("interviewCatalogInstallations")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (prior) {
      if (prior.sourceSha256 !== interviewCatalogue.sourceSha256)
        throw new ConvexError({ code: "CATALOGUE_VERSION_CONFLICT", status: 409 });
      return { alreadyInstalled: true, questions: prior.questions };
    }
    const existing = await ctx.db
      .query("interview_questions")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", null))
      .take(1001);
    if (
      existing.length > 1000 ||
      existing.some((row) =>
        interviewCatalogue.questions.some(
          (question) => question.code === row.code || question.id === row.id,
        ),
      )
    )
      throw new ConvexError({ code: "CATALOGUE_IDENTIFIER_CONFLICT", status: 409 });
    const now = new Date().toISOString();
    for (const question of interviewCatalogue.questions) {
      if (
        await ctx.db
          .query("interview_questions")
          .withIndex("by_business_id", (q) => q.eq("id", question.id))
          .first()
      )
        throw new ConvexError({ code: "CATALOGUE_IDENTIFIER_CONFLICT", status: 409 });
      await ctx.db.insert("interview_questions", {
        legacyKey: JSON.stringify([question.id]),
        ...question,
        organizationId: null,
        version: 1,
        helpText: null,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.insert("interviewCatalogInstallations", {
      key,
      sourceSha256: interviewCatalogue.sourceSha256,
      questions: interviewCatalogue.questions.length,
      installedAt: now,
    });
    return { alreadyInstalled: false, questions: interviewCatalogue.questions.length };
  },
});
