import { ConvexError, v } from "convex/values";
import { ZodError } from "zod";
import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { requireOrganization } from "./lib/access";
import { ConvexCompanyRepository } from "./lib/companyRepository";
import { CompanyService } from "../src/modules/companies/application/company-service";
import { CompanyError } from "../src/modules/companies/domain/company-errors";
import {
  companyIdSchema,
  companyInputSchema,
  companyListQuerySchema,
  companyUpdateSchema,
} from "../src/modules/companies/application/company-schemas";

type JsonDates<T> = T extends Date
  ? string
  : T extends readonly (infer U)[]
    ? JsonDates<U>[]
    : T extends object
      ? { [K in keyof T]: JsonDates<T[K]> }
      : T;
function serialize<T>(value: T): JsonDates<T> {
  return JSON.parse(JSON.stringify(value));
}
async function run<T>(
  ctx: QueryCtx | MutationCtx,
  operation: (service: CompanyService) => Promise<T>,
) {
  try {
    const scope = await requireOrganization(ctx);
    return serialize(
      await operation(new CompanyService(new ConvexCompanyRepository(ctx, scope), scope.userId)),
    );
  } catch (error) {
    if (error instanceof ConvexError) throw error;
    if (error instanceof ZodError) throw new ConvexError({ code: "VALIDATION_ERROR", status: 400 });
    if (error instanceof CompanyError)
      throw new ConvexError({ code: error.code, status: error.status, message: error.message });
    throw new ConvexError({ code: "INTERNAL_ERROR", status: 500 });
  }
}
const companyInput = v.object({
  name: v.string(),
  status: v.optional(v.string()),
  sectorId: v.optional(v.string()),
  employeeCount: v.optional(v.number()),
  companySize: v.optional(v.string()),
  primaryContactName: v.optional(v.string()),
  primaryContactRole: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  website: v.optional(v.string()),
  address: v.optional(v.string()),
  city: v.optional(v.string()),
  country: v.optional(v.string()),
  description: v.optional(v.string()),
  internalNotes: v.optional(v.string()),
});
export const list = query({
  args: {
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    search: v.optional(v.string()),
    status: v.optional(v.string()),
    companySize: v.optional(v.string()),
    sectorId: v.optional(v.string()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.string()),
    includeArchived: v.optional(v.boolean()),
  },
  handler: (ctx, args) => run(ctx, (service) => service.list(companyListQuerySchema.parse(args))),
});
export const get = query({
  args: { id: v.string() },
  handler: (ctx, args) => run(ctx, (service) => service.get(companyIdSchema.parse(args.id))),
});
export const create = mutation({
  args: { input: companyInput },
  handler: (ctx, args) =>
    run(ctx, (service) => service.create(companyInputSchema.parse(args.input))),
});
export const update = mutation({
  args: {
    id: v.string(),
    input: v.object({
      name: v.optional(v.string()),
      status: v.optional(v.string()),
      sectorId: v.optional(v.string()),
      employeeCount: v.optional(v.number()),
      companySize: v.optional(v.string()),
      primaryContactName: v.optional(v.string()),
      primaryContactRole: v.optional(v.string()),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      website: v.optional(v.string()),
      address: v.optional(v.string()),
      city: v.optional(v.string()),
      country: v.optional(v.string()),
      description: v.optional(v.string()),
      internalNotes: v.optional(v.string()),
    }),
  },
  handler: (ctx, args) =>
    run(ctx, (service) =>
      service.update(companyIdSchema.parse(args.id), companyUpdateSchema.parse(args.input)),
    ),
});
export const archive = mutation({
  args: { id: v.string() },
  handler: (ctx, args) => run(ctx, (service) => service.archive(companyIdSchema.parse(args.id))),
});
export const restore = mutation({
  args: { id: v.string() },
  handler: (ctx, args) => run(ctx, (service) => service.restore(companyIdSchema.parse(args.id))),
});
