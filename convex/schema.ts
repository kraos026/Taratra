import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { businessTables } from "./modelSchema";

export default defineSchema({
  ...businessTables,
  catalogInstallations: defineTable({
    key: v.string(),
    sourceSha256: v.string(),
    templateId: v.string(),
    versionId: v.string(),
    sections: v.number(),
    questions: v.number(),
    installedAt: v.string(),
  }).index("by_key", ["key"]),
  identityLinks: defineTable({
    tokenIdentifier: v.string(),
    userId: v.string(),
    createdAt: v.string(),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_userId", ["userId"]),
  migrationState: defineTable({
    key: v.literal("optivos-supabase-to-convex-v1"),
    stage: v.union(v.literal("preparing"), v.literal("imported"), v.literal("verified")),
    updatedAt: v.string(),
    sourceDigest: v.union(v.string(), v.null()),
  }).index("by_key", ["key"]),
});
