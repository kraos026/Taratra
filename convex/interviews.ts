import { ConvexError, v } from "convex/values";
import { ZodError } from "zod";
import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { requireOrganization } from "./lib/access";
import { ConvexInterviewRepository } from "./lib/interviewRepository";
import { InterviewService } from "../src/modules/interviews/application/interview-service";
import {
  interviewIdSchema,
  interviewAnswerSchema,
  interviewSkipSchema,
  interviewBackSchema,
} from "../src/modules/interviews/application/interview-schemas";
import { InterviewError } from "../src/modules/interviews/domain/interview-errors";
type JsonDates<T> = T extends Date
  ? string
  : T extends readonly (infer U)[]
    ? JsonDates<U>[]
    : T extends object
      ? { [K in keyof T]: JsonDates<T[K]> }
      : T;
async function run<T>(
  ctx: QueryCtx | MutationCtx,
  operation: (service: InterviewService) => Promise<T>,
): Promise<JsonDates<T>> {
  try {
    const scope = await requireOrganization(ctx);
    return JSON.parse(
      JSON.stringify(
        await operation(
          new InterviewService(new ConvexInterviewRepository(ctx, scope), scope.userId),
        ),
      ),
    );
  } catch (error) {
    if (error instanceof ConvexError) throw error;
    if (error instanceof ZodError) throw new ConvexError({ code: "VALIDATION_ERROR", status: 400 });
    if (error instanceof InterviewError)
      throw new ConvexError({ code: error.code, status: error.status, message: error.message });
    throw new ConvexError({ code: "INTERNAL_ERROR", status: 500 });
  }
}
export const companyView = query({
  args: { companyId: v.string() },
  handler: (ctx, args) =>
    run(ctx, (service) => service.companyView(interviewIdSchema.parse(args.companyId))),
});
export const get = query({
  args: { id: v.string() },
  handler: (ctx, args) => run(ctx, (service) => service.view(interviewIdSchema.parse(args.id))),
});
export const start = mutation({
  args: { companyId: v.string() },
  handler: (ctx, args) =>
    run(ctx, (service) => service.start(interviewIdSchema.parse(args.companyId))),
});
export const answer = mutation({
  args: {
    id: v.string(),
    lockVersion: v.number(),
    questionId: v.string(),
    value: v.any(),
    confidence: v.string(),
    documentSource: v.optional(v.any()),
  },
  handler: (ctx, args) =>
    run(ctx, async (service) => {
      const input = interviewAnswerSchema.parse(args);
      await service.persistAnswer(
        interviewIdSchema.parse(args.id),
        input.lockVersion,
        input.questionId,
        input.value,
        input.confidence,
        input.documentSource,
      );
      return service.refreshAnswerProgress(args.id);
    }),
});
export const skip = mutation({
  args: { id: v.string(), lockVersion: v.number(), questionId: v.string(), reason: v.string() },
  handler: (ctx, args) =>
    run(ctx, (service) => {
      const input = interviewSkipSchema.parse(args);
      return service.skip(
        interviewIdSchema.parse(args.id),
        input.lockVersion,
        input.questionId,
        input.reason,
      );
    }),
});
export const back = mutation({
  args: { id: v.string(), lockVersion: v.number(), questionId: v.string() },
  handler: (ctx, args) =>
    run(ctx, (service) => {
      const input = interviewBackSchema.parse(args);
      return service.goBack(interviewIdSchema.parse(args.id), input.lockVersion, input.questionId);
    }),
});
export const complete = mutation({
  args: { id: v.string() },
  handler: (ctx, args) => run(ctx, (service) => service.complete(interviewIdSchema.parse(args.id))),
});
export const validate = mutation({
  args: { id: v.string() },
  handler: (ctx, args) => run(ctx, (service) => service.validate(interviewIdSchema.parse(args.id))),
});
