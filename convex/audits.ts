import { ConvexError, v } from "convex/values";
import { ZodError } from "zod";
import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { AuditService } from "../src/modules/audits/application/audit-service";
import {
  auditCreateSchema,
  auditListSchema,
  auditUpdateSchema,
} from "../src/modules/audits/application/audit-schemas";
import { AuditError } from "../src/modules/audits/domain/audit-errors";
import { QuestionnaireError } from "../src/modules/questionnaires/domain/questionnaire-errors";
import { idSchema } from "../src/modules/questionnaires/application/questionnaire-schemas";
import { requireOrganization } from "./lib/access";
import { ConvexAuditRepository } from "./lib/auditRepository";
type JsonDates<T> = T extends Date
  ? string
  : T extends readonly (infer U)[]
    ? JsonDates<U>[]
    : T extends object
      ? { [K in keyof T]: JsonDates<T[K]> }
      : T;
async function run<T>(
  ctx: QueryCtx | MutationCtx,
  operation: (service: AuditService) => Promise<T>,
): Promise<JsonDates<T>> {
  try {
    const scope = await requireOrganization(ctx);
    return JSON.parse(
      JSON.stringify(
        await operation(new AuditService(new ConvexAuditRepository(ctx, scope), scope.userId)),
      ),
    );
  } catch (error) {
    if (error instanceof ConvexError) throw error;
    if (error instanceof ZodError) throw new ConvexError({ code: "VALIDATION_ERROR", status: 400 });
    if (error instanceof AuditError || error instanceof QuestionnaireError)
      throw new ConvexError({ code: error.code, status: error.status, message: error.message });
    throw new ConvexError({ code: "INTERNAL_ERROR", status: 500 });
  }
}
export const list = query({
  args: {
    companyId: v.optional(v.string()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    status: v.optional(v.string()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.string()),
  },
  handler: (ctx, args) => run(ctx, (service) => service.list(auditListSchema.parse(args))),
});
export const get = query({
  args: { id: v.string() },
  handler: (ctx, args) => run(ctx, (service) => service.get(idSchema.parse(args.id))),
});
export const create = mutation({
  args: { companyId: v.string(), questionnaireVersionId: v.string() },
  handler: (ctx, args) => run(ctx, (service) => service.create(auditCreateSchema.parse(args))),
});
export const update = mutation({
  args: { id: v.string(), currentSectionId: v.union(v.string(), v.null()) },
  handler: (ctx, args) =>
    run(ctx, (service) =>
      service.update(
        idSchema.parse(args.id),
        auditUpdateSchema.parse({ currentSectionId: args.currentSectionId }),
      ),
    ),
});
export const answer = mutation({
  args: { id: v.string(), questionId: v.string(), value: v.any() },
  handler: (ctx, args) =>
    run(ctx, (service) =>
      service.answer(idSchema.parse(args.id), idSchema.parse(args.questionId), args.value),
    ),
});
export const complete = mutation({
  args: { id: v.string() },
  handler: (ctx, args) => run(ctx, (service) => service.complete(idSchema.parse(args.id))),
});
export const validate = mutation({
  args: { id: v.string() },
  handler: (ctx, args) => run(ctx, (service) => service.validate(idSchema.parse(args.id))),
});
export const archive = mutation({
  args: { id: v.string() },
  handler: (ctx, args) => run(ctx, (service) => service.archive(idSchema.parse(args.id))),
});
