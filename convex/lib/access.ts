import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { OrganizationContext } from "../../src/modules/companies/domain/company";

export type DatabaseCtx = QueryCtx | MutationCtx;
export type TrustedContext = OrganizationContext & { userId: string };
export async function requireOrganization(ctx: DatabaseCtx): Promise<TrustedContext> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", status: 401 });
  const link = await ctx.db
    .query("identityLinks")
    .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (!link) throw new ConvexError({ code: "IDENTITY_NOT_MIGRATED", status: 403 });
  const memberships = await ctx.db
    .query("organization_members")
    .withIndex("by_userId", (q) => q.eq("userId", link.userId))
    .collect();
  if (new Set(memberships.map((member) => member.organizationId)).size !== memberships.length)
    throw new ConvexError({ code: "AMBIGUOUS_MEMBERSHIP", status: 403 });
  memberships.sort(
    (a, b) =>
      Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
      a.organizationId.localeCompare(b.organizationId),
  );
  for (const member of memberships) {
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_business_id", (q) => q.eq("id", member.organizationId))
      .unique();
    if (organization && organization.deletedAt === null)
      return { userId: link.userId, organizationId: member.organizationId, role: member.role };
  }
  throw new ConvexError({ code: "ORGANIZATION_REQUIRED", status: 403 });
}
