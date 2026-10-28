import { ConvexError, v } from "convex/values";
import { ZodError } from "zod";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireOrganization } from "./lib/access";
import { ConvexDiscoveryRepository } from "./lib/discoveryRepository";
import { DiscoveryService } from "../src/modules/discovery/application/discovery-service";
import { DiscoveryError } from "../src/modules/discovery/domain/discovery-errors";
import { discoveryAutosaveSchema } from "../src/modules/discovery/application/discovery-schemas";
import { idSchema } from "../src/modules/questionnaires/application/questionnaire-schemas";
type JsonDates<T> = T extends Date
  ? string
  : T extends readonly (infer U)[]
    ? JsonDates<U>[]
    : T extends object
      ? { [K in keyof T]: JsonDates<T[K]> }
      : T;
async function run<T>(
  ctx: QueryCtx | MutationCtx,
  operation: (service: DiscoveryService) => Promise<T>,
): Promise<JsonDates<T>> {
  try {
    const scope = await requireOrganization(ctx);
    return JSON.parse(
      JSON.stringify(
        await operation(
          new DiscoveryService(new ConvexDiscoveryRepository(ctx, scope), scope.userId),
        ),
      ),
    );
  } catch (error) {
    if (error instanceof ConvexError) throw error;
    if (error instanceof ZodError) throw new ConvexError({ code: "VALIDATION_ERROR", status: 400 });
    if (error instanceof DiscoveryError)
      throw new ConvexError({ code: error.code, status: error.status, message: error.message });
    throw new ConvexError({ code: "INTERNAL_ERROR", status: 500 });
  }
}
export const companySession = query({
  args: { companyId: v.string() },
  handler: (ctx, args) =>
    run(ctx, (service) => service.companySession(idSchema.parse(args.companyId))),
});
export const get = query({
  args: { id: v.string() },
  handler: (ctx, args) => run(ctx, (service) => service.get(idSchema.parse(args.id))),
});
export const start = mutation({
  args: { companyId: v.string() },
  handler: (ctx, args) => run(ctx, (service) => service.start(idSchema.parse(args.companyId))),
});
export const save = mutation({
  args: { id: v.string(), lockVersion: v.number(), payload: v.any() },
  handler: (ctx, args) =>
    run(ctx, (service) => {
      const input = discoveryAutosaveSchema.parse(args);
      return service.autosave(idSchema.parse(args.id), input.lockVersion, input.payload);
    }),
});
export const validate = mutation({
  args: { id: v.string() },
  handler: (ctx, args) => run(ctx, (service) => service.validate(idSchema.parse(args.id))),
});
