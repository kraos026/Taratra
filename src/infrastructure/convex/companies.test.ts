/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";

const modules = import.meta.glob("../../../convex/**/*.ts");
const orgA = "10000000-0000-4000-8000-000000000001";
const orgB = "10000000-0000-4000-8000-000000000002";
const userId = "20000000-0000-4000-8000-000000000001";
const tokenIdentifier = "https://identity.test|editor";
const now = "2026-10-27T00:00:00.000Z";

async function setup(role: "owner" | "viewer" = "owner") {
  const t = convexTest(schema, modules);
  const memberId = await t.run(async (ctx) => {
    for (const id of [orgA, orgB]) {
      await ctx.db.insert("organizations", {
        legacyKey: JSON.stringify([id]),
        id,
        name: id,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
    }
    await ctx.db.insert("identityLinks", { tokenIdentifier, userId, createdAt: now });
    return ctx.db.insert("organization_members", {
      legacyKey: JSON.stringify([orgA, userId]),
      organizationId: orgA,
      userId,
      role,
      createdAt: now,
      updatedAt: now,
    });
  });
  const editor = t.withIdentity({ tokenIdentifier });
  const foreign = await t.run(async (ctx) => {
    const id = "30000000-0000-4000-8000-000000000002";
    return ctx.db.insert("companies", {
      legacyKey: JSON.stringify([id]),
      id,
      organizationId: orgB,
      name: "Private tenant B",
      status: "prospect",
      sectorId: null,
      employeeCount: null,
      companySize: null,
      primaryContactName: null,
      primaryContactRole: null,
      phone: null,
      email: null,
      website: null,
      address: null,
      city: null,
      country: null,
      description: null,
      internalNotes: "Private",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  });
  return { t, editor, memberId, foreignId: (await t.run((ctx) => ctx.db.get(foreign)))!.id };
}

describe("Convex company boundary", () => {
  it("rejects anonymous and unmapped identities", async () => {
    const { t } = await setup();
    await expect(t.query(api.companies.list, {})).rejects.toThrow("UNAUTHENTICATED");
    await expect(
      t.withIdentity({ subject: "unknown" }).query(api.companies.list, {}),
    ).rejects.toThrow("IDENTITY_NOT_MIGRATED");
  });
  it("uses canonical defaults, DTOs and archive/restore behavior", async () => {
    const { editor } = await setup();
    const company = await editor.mutation(api.companies.create, {
      input: { name: "  Optivos pilot  " },
    });
    expect(company).toMatchObject({
      name: "Optivos pilot",
      status: "prospect",
      organizationId: orgA,
      employeeCount: null,
    });
    expect(company.id).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
    );
    expect(company).not.toHaveProperty("_id");
    expect(company).not.toHaveProperty("legacyKey");
    expect(new Date(company.createdAt).toISOString()).toBe(company.createdAt);
    expect(
      await editor.mutation(api.companies.update, {
        id: company.id,
        input: { city: "Antananarivo" },
      }),
    ).toMatchObject({ city: "Antananarivo" });
    await editor.mutation(api.companies.archive, { id: company.id });
    expect((await editor.query(api.companies.list, {})).total).toBe(0);
    expect((await editor.query(api.companies.list, { includeArchived: true })).total).toBe(1);
    await editor.mutation(api.companies.restore, { id: company.id });
    expect((await editor.query(api.companies.list, {})).total).toBe(1);
  });
  it("rejects cross-tenant reads and writes without leaking records", async () => {
    const { t, editor, foreignId } = await setup();
    expect((await editor.query(api.companies.list, {})).items).toEqual([]);
    await expect(editor.query(api.companies.get, { id: foreignId })).rejects.toThrow(
      "COMPANY_NOT_FOUND",
    );
    await expect(
      editor.mutation(api.companies.update, { id: foreignId, input: { name: "Stolen" } }),
    ).rejects.toThrow("COMPANY_NOT_FOUND");
    expect(await t.run((ctx) => ctx.db.query("companies").collect())).toEqual([
      expect.objectContaining({ name: "Private tenant B", organizationId: orgB }),
    ]);
  });
  it("enforces viewer permissions and fresh membership revocation", async () => {
    const { t, editor, memberId } = await setup("viewer");
    expect((await editor.query(api.companies.list, {})).permissions.canWrite).toBe(false);
    await expect(
      editor.mutation(api.companies.create, { input: { name: "Forbidden" } }),
    ).rejects.toThrow("COMPANY_FORBIDDEN");
    await t.run((ctx) => ctx.db.delete(memberId));
    await expect(editor.query(api.companies.list, {})).rejects.toThrow("ORGANIZATION_REQUIRED");
  });
  it("fails closed for duplicate membership records", async () => {
    const { t, editor } = await setup("viewer");
    await t.run((ctx) =>
      ctx.db.insert("organization_members", {
        legacyKey: "duplicate",
        organizationId: orgA,
        userId,
        role: "owner",
        createdAt: now,
        updatedAt: now,
      }),
    );
    await expect(editor.query(api.companies.list, {})).rejects.toThrow("AMBIGUOUS_MEMBERSHIP");
  });
  it("returns safe validation failures and rejects caller-supplied tenants", async () => {
    const { editor } = await setup();
    await expect(editor.mutation(api.companies.create, { input: { name: "x" } })).rejects.toThrow(
      "VALIDATION_ERROR",
    );
    await expect(editor.query(api.companies.get, { id: "invalid" })).rejects.toThrow(
      "VALIDATION_ERROR",
    );
    // Deliberately bypass the generated client type to verify server argument validation.
    const forged = { input: { name: "Forged", organizationId: orgB } };
    await expect(editor.mutation(api.companies.create, forged)).rejects.toThrow();
  });
  it("preserves enum and null ordering for supported list fields", async () => {
    const { editor } = await setup();
    for (const input of [
      { name: "A client", status: "client", companySize: "micro" },
      { name: "B prospect", status: "prospect", companySize: "enterprise" },
      { name: "C null" },
    ]) {
      await editor.mutation(api.companies.create, { input });
    }
    const statuses = await editor.query(api.companies.list, { sortBy: "status", sortOrder: "asc" });
    expect(statuses.items.map((item) => item.status)).toEqual(["prospect", "prospect", "client"]);
    const sizes = await editor.query(api.companies.list, {
      sortBy: "companySize",
      sortOrder: "asc",
    });
    expect(sizes.items.map((item) => item.companySize)).toEqual(["micro", "enterprise", null]);
  });
});
