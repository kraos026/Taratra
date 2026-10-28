import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOrganization } from "./lib/access";
import { businessId } from "./lib/businessId";

export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", status: 401 });
    const link = await ctx.db
      .query("identityLinks")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!link) return null;
    const scope = await requireOrganization(ctx);
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_business_id", (q) => q.eq("id", scope.organizationId))
      .unique();
    if (!organization) throw new ConvexError({ code: "ORGANIZATION_REQUIRED", status: 403 });
    return { organizationId: organization.id, name: organization.name, role: scope.role };
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    if (process.env.OPTIVOS_CONVEX_FRESH_PILOT !== "1")
      throw new ConvexError({ code: "PILOT_DISABLED", status: 403 });
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", status: 401 });
    const name = args.name.trim();
    if (name.length < 2 || name.length > 160)
      throw new ConvexError({ code: "VALIDATION_ERROR", status: 400 });
    const existing = await ctx.db
      .query("identityLinks")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    // A retry returns the existing workspace. A revoked membership never becomes a new owner.
    if (existing) {
      const scope = await requireOrganization(ctx);
      return { organizationId: scope.organizationId };
    }
    const now = new Date().toISOString();
    const userId = businessId(),
      organizationId = businessId();
    if (
      await ctx.db
        .query("organizations")
        .withIndex("by_business_id", (q) => q.eq("id", organizationId))
        .first()
    )
      throw new ConvexError({ code: "IDENTIFIER_COLLISION", status: 409 });
    if (
      await ctx.db
        .query("identityLinks")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first()
    )
      throw new ConvexError({ code: "IDENTIFIER_COLLISION", status: 409 });
    await ctx.db.insert("organizations", {
      legacyKey: JSON.stringify([organizationId]),
      id: organizationId,
      name,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    await ctx.db.insert("organization_members", {
      legacyKey: JSON.stringify([organizationId, userId]),
      organizationId,
      userId,
      role: "owner",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("identityLinks", {
      tokenIdentifier: identity.tokenIdentifier,
      userId,
      createdAt: now,
    });
    return { organizationId };
  },
});
