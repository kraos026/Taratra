/// <reference types="vite/client" />
import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";
import { discoveryDecimal } from "../../../convex/lib/discoveryRepository";
import type { DiscoveryPayload } from "@/modules/discovery/application/discovery-schemas";
const modules = import.meta.glob("../../../convex/**/*.ts");
afterEach(() => vi.unstubAllEnvs());
const payloads: DiscoveryPayload[] = [
  {
    step: "company",
    industry: "Conseil",
    countryCode: "mg",
    employeeCount: 2,
    description: "Services aux entreprises",
  },
  {
    step: "business",
    businessModel: "Prestations",
    growthStage: "Établie",
    revenueAmount: 1.005,
    revenueCurrency: "usd",
    revenueYear: 2026,
    offerings: [{ type: "service", name: "Conseil" }],
    objectives: [{ title: "Réduire les délais", priority: 3, targetDate: "2026-12-01" }],
    challenges: [{ title: "Double saisie", severity: 3 }],
  },
  {
    step: "organization",
    departments: [{ clientId: "ops", name: "Opérations", headcount: 2 }],
    roles: [
      {
        departmentClientId: "ops",
        title: "Consultant",
        headcount: 2,
        responsibilities: ["Facturation"],
      },
    ],
  },
  { step: "software", items: [{ name: "Tableur", criticality: 3, usersCount: 2 }] },
  {
    step: "processes",
    items: [
      {
        name: "Facturation",
        categoryCode: "operations",
        frequency: "Mensuelle",
        volume: 100,
        manualHoursMonth: 1.005,
        painPoints: ["Double saisie"],
      },
    ],
  },
  { step: "review", confirmed: true },
];
async function setup() {
  vi.stubEnv("OPTIVOS_CONVEX_FRESH_PILOT", "1");
  const t = convexTest(schema, modules),
    owner = t.withIdentity({ subject: "discovery-owner" }),
    other = t.withIdentity({ subject: "discovery-other" });
  const org = await owner.mutation(api.workspaces.create, { name: "Discovery organization" });
  await other.mutation(api.workspaces.create, { name: "Other organization" });
  const company = await owner.mutation(api.companies.create, {
    input: { name: "Discovery company" },
  });
  return { t, owner, other, company, org };
}
describe("Convex main Discovery journey", () => {
  it("starts once and refuses early validation", async () => {
    const { owner, company, t } = await setup();
    const a = await owner.mutation(api.discovery.start, { companyId: company.id });
    const b = await owner.mutation(api.discovery.start, { companyId: company.id });
    expect(a.id).toBe(b.id);
    expect(a.answers).toEqual([]);
    await expect(owner.mutation(api.discovery.validate, { id: a.id })).rejects.toThrow(
      "VALIDATION_ERROR",
    );
    expect(
      await t.run(async (ctx) => (await ctx.db.query("discovery_sessions").collect()).length),
    ).toBe(1);
  });
  it("materializes the six canonical steps, validates and locks the real company context", async () => {
    const { owner, company, t } = await setup();
    let session = await owner.mutation(api.discovery.start, { companyId: company.id });
    for (const payload of payloads)
      session = (await owner.mutation(api.discovery.save, {
        id: session.id,
        lockVersion: session.lockVersion,
        payload,
      }))!;
    expect(session.status).toBe("completed");
    expect(session.answers).toHaveLength(6);
    expect(session.lockVersion).toBe(7);
    const context = await t.run(async (ctx) => ({
      profile: await ctx.db.query("company_profiles").unique(),
      roles: await ctx.db.query("company_roles").collect(),
      departments: await ctx.db.query("departments").collect(),
      processes: await ctx.db.query("business_processes").collect(),
      offerings: await ctx.db.query("company_offerings").collect(),
    }));
    expect(context.profile).toMatchObject({
      companyId: company.id,
      countryCode: "MG",
      revenueCurrency: "USD",
      revenueAmount: "1.01",
    });
    expect(context.roles[0].departmentId).toBe(context.departments[0].id);
    expect(context.processes[0]).toMatchObject({ volume: "100.00", manualHoursMonth: "1.01" });
    expect(context.offerings).toHaveLength(1);
    const validated = await owner.mutation(api.discovery.validate, { id: session.id });
    expect(validated.status).toBe("validated");
    expect(validated.lockVersion).toBe(8);
    await expect(
      owner.mutation(api.discovery.save, {
        id: session.id,
        lockVersion: validated.lockVersion,
        payload: payloads[0],
      }),
    ).rejects.toThrow("CONFLICT");
    expect(
      (await owner.query(api.discovery.companySession, { companyId: company.id })).status,
    ).toBe("validated");
    expect((await owner.mutation(api.discovery.start, { companyId: company.id })).id).toBe(
      session.id,
    );
  });
  it("rejects stale edits without duplicate answers or partial context writes", async () => {
    const { owner, company, t } = await setup();
    const session = await owner.mutation(api.discovery.start, { companyId: company.id });
    const first = (await owner.mutation(api.discovery.save, {
      id: session.id,
      lockVersion: 1,
      payload: payloads[0],
    }))!;
    await expect(
      owner.mutation(api.discovery.save, {
        id: session.id,
        lockVersion: 1,
        payload: { ...payloads[0], employeeCount: 500 },
      }),
    ).rejects.toThrow("CONFLICT");
    expect(first.answers).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.query("company_profiles").unique())).toMatchObject({
      employeeCount: 2,
    });
    expect((await owner.query(api.discovery.get, { id: session.id })).lockVersion).toBe(2);
  });
  it("rolls back replacements and lock changes when a department reference is invalid", async () => {
    const { owner, company, t } = await setup();
    let session = await owner.mutation(api.discovery.start, { companyId: company.id });
    session = (await owner.mutation(api.discovery.save, {
      id: session.id,
      lockVersion: 1,
      payload: payloads[2],
    }))!;
    const departments = await t.run((ctx) => ctx.db.query("departments").collect());
    const invalid = {
      step: "organization",
      departments: [],
      roles: [
        { departmentClientId: "missing", title: "Invalid", headcount: 1, responsibilities: [] },
      ],
    };
    await expect(
      owner.mutation(api.discovery.save, {
        id: session.id,
        lockVersion: session.lockVersion,
        payload: invalid,
      }),
    ).rejects.toThrow("VALIDATION_ERROR");
    expect(await t.run((ctx) => ctx.db.query("departments").collect())).toEqual(departments);
    expect((await owner.query(api.discovery.get, { id: session.id })).lockVersion).toBe(
      session.lockVersion,
    );
  });
  it("refuses cross-tenant discovery, anonymous calls and viewer writes", async () => {
    const { owner, other, company, t, org } = await setup();
    const session = await owner.mutation(api.discovery.start, { companyId: company.id });
    await expect(other.mutation(api.discovery.start, { companyId: company.id })).rejects.toThrow(
      "NOT_FOUND",
    );
    await expect(other.query(api.discovery.get, { id: session.id })).rejects.toThrow("NOT_FOUND");
    await expect(
      other.mutation(api.discovery.save, { id: session.id, lockVersion: 1, payload: payloads[0] }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(t.query(api.discovery.get, { id: session.id })).rejects.toThrow("UNAUTHENTICATED");
    const member = await t.run((ctx) =>
      ctx.db
        .query("organization_members")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", org.organizationId))
        .unique(),
    );
    await t.run((ctx) => ctx.db.patch(member!._id, { role: "viewer" }));
    await expect(
      owner.mutation(api.discovery.save, { id: session.id, lockVersion: 1, payload: payloads[0] }),
    ).rejects.toThrow("FORBIDDEN");
  });
  it("matches decimal rounding and source NUMERIC bounds without toFixed errors", () => {
    expect(discoveryDecimal(1.005, 18)).toBe("1.01");
    expect(discoveryDecimal(0.005, 18)).toBe("0.01");
    expect(discoveryDecimal(1e-7, 18)).toBe("0.00");
    expect(discoveryDecimal(null, 18)).toBeNull();
    expect(() => discoveryDecimal(1e20, 18)).toThrow("precision");
    expect(() => discoveryDecimal(Infinity, 18)).toThrow("Invalid decimal");
  });
  it("replaces only the current company's draft lists", async () => {
    const { owner, company, t } = await setup();
    const secondCompany = await owner.mutation(api.companies.create, {
      input: { name: "Second company" },
    });
    const first = await owner.mutation(api.discovery.start, { companyId: company.id });
    const second = await owner.mutation(api.discovery.start, { companyId: secondCompany.id });
    const saved = (await owner.mutation(api.discovery.save, {
      id: first.id,
      lockVersion: 1,
      payload: payloads[1],
    }))!;
    await owner.mutation(api.discovery.save, {
      id: second.id,
      lockVersion: 1,
      payload: payloads[1],
    });
    await owner.mutation(api.discovery.save, {
      id: first.id,
      lockVersion: saved.lockVersion,
      payload: payloads[1],
    });
    const rows = await t.run((ctx) => ctx.db.query("company_offerings").collect());
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.companyId))).toEqual(
      new Set([company.id, secondCompany.id]),
    );
  });
});
