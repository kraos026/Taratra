/// <reference types="vite/client" />
import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";
const modules = import.meta.glob("../../../convex/**/*.ts");
afterEach(() => vi.unstubAllEnvs());

describe("New Convex pilot organizations", () => {
  it("requires authentication and explicit pilot activation", async () => {
    const t = convexTest(schema, modules);
    vi.stubEnv("OPTIVOS_CONVEX_FRESH_PILOT", "0");
    await expect(
      t.withIdentity({ subject: "owner" }).mutation(api.workspaces.create, { name: "Optivos" }),
    ).rejects.toThrow("PILOT_DISABLED");
    vi.stubEnv("OPTIVOS_CONVEX_FRESH_PILOT", "1");
    await expect(t.mutation(api.workspaces.create, { name: "Optivos" })).rejects.toThrow(
      "UNAUTHENTICATED",
    );
    await expect(t.query(api.workspaces.current, {})).rejects.toThrow("UNAUTHENTICATED");
  });
  it("creates an owner atomically and makes retries idempotent", async () => {
    vi.stubEnv("OPTIVOS_CONVEX_FRESH_PILOT", "1");
    const t = convexTest(schema, modules),
      owner = t.withIdentity({ subject: "new-owner" });
    expect(await owner.query(api.workspaces.current, {})).toBeNull();
    const first = await owner.mutation(api.workspaces.create, { name: "  Optivos pilote  " });
    expect(await owner.mutation(api.workspaces.create, { name: "Retry" })).toEqual(first);
    expect(await owner.query(api.workspaces.current, {})).toEqual({
      ...first,
      name: "Optivos pilote",
      role: "owner",
    });
    const counts = await t.run(async (ctx) => ({
      organizations: (await ctx.db.query("organizations").collect()).length,
      memberships: (await ctx.db.query("organization_members").collect()).length,
      links: (await ctx.db.query("identityLinks").collect()).length,
    }));
    expect(counts).toEqual({ organizations: 1, memberships: 1, links: 1 });
    expect(
      await owner.mutation(api.companies.create, { input: { name: "Real persisted company" } }),
    ).toMatchObject({ organizationId: first.organizationId });
  });
  it("keeps two new users isolated even when their email claims match", async () => {
    vi.stubEnv("OPTIVOS_CONVEX_FRESH_PILOT", "1");
    const t = convexTest(schema, modules);
    const a = t.withIdentity({ subject: "a", email: "same@example.test" }),
      b = t.withIdentity({ subject: "b", email: "same@example.test" });
    const first = await a.mutation(api.workspaces.create, { name: "A company" });
    const second = await b.mutation(api.workspaces.create, { name: "B company" });
    expect(first.organizationId).not.toBe(second.organizationId);
    const company = await a.mutation(api.companies.create, { input: { name: "Private A" } });
    expect((await b.query(api.companies.list, {})).total).toBe(0);
    await expect(b.query(api.companies.get, { id: company.id })).rejects.toThrow(
      "COMPANY_NOT_FOUND",
    );
  });
  it("does not recreate owner access after membership revocation", async () => {
    vi.stubEnv("OPTIVOS_CONVEX_FRESH_PILOT", "1");
    const t = convexTest(schema, modules),
      owner = t.withIdentity({ subject: "revoked" });
    await owner.mutation(api.workspaces.create, { name: "Revoked organization" });
    await t.run(async (ctx) => {
      const member = await ctx.db.query("organization_members").unique();
      await ctx.db.delete(member!._id);
    });
    await expect(owner.mutation(api.workspaces.create, { name: "Escalation" })).rejects.toThrow(
      "ORGANIZATION_REQUIRED",
    );
    expect(await t.run(async (ctx) => (await ctx.db.query("organizations").collect()).length)).toBe(
      1,
    );
  });
});
