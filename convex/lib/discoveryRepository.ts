import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type {
  DiscoveryRepository,
  DiscoveryRecord,
} from "../../src/modules/discovery/application/discovery-repository";
import type { DiscoveryPayload } from "../../src/modules/discovery/application/discovery-schemas";
import {
  DiscoveryConflictError,
  DiscoveryForbiddenError,
  DiscoveryNotFoundError,
  DiscoveryValidationError,
} from "../../src/modules/discovery/domain/discovery-errors";
import type { DatabaseCtx, TrustedContext } from "./access";
import { modelRecord } from "./modelRecord";
import { mapCompany } from "./companyRepository";
import { businessId } from "./businessId";

// Quantize the input's decimal text like PostgreSQL NUMERIC, without binary toFixed rounding.
export function discoveryDecimal(value: number | null, precision: number): string | null {
  if (value === null) return null;
  if (!Number.isFinite(value) || value < 0)
    throw new DiscoveryValidationError("Invalid decimal value");
  const [mantissa, exponent = "0"] = value.toString().split("e");
  const [whole, fraction = ""] = mantissa.split(".");
  const digits = BigInt(whole + fraction),
    shift = Number(exponent) - fraction.length + 2;
  const divisor = shift < 0 ? 10n ** BigInt(-shift) : 1n;
  const scaled = shift < 0 ? (digits + divisor / 2n) / divisor : digits * 10n ** BigInt(shift);
  if (scaled.toString().length > precision)
    throw new DiscoveryValidationError("Decimal exceeds storage precision");
  const text = scaled.toString().padStart(3, "0");
  return `${text.slice(0, -2)}.${text.slice(-2)}`;
}
type MaterialTable =
  | "company_offerings"
  | "company_objectives"
  | "business_challenges"
  | "company_roles"
  | "departments"
  | "company_software"
  | "business_processes";
type ProfileChanges = Partial<
  Pick<
    Doc<"company_profiles">,
    | "industry"
    | "countryCode"
    | "employeeCount"
    | "metadataJson"
    | "businessModel"
    | "growthStage"
    | "revenueAmount"
    | "revenueCurrency"
    | "revenueYear"
  >
>;
export class ConvexDiscoveryRepository implements DiscoveryRepository {
  constructor(
    private readonly ctx: DatabaseCtx,
    private readonly scope: TrustedContext,
  ) {}
  private writer() {
    if (!("insert" in this.ctx.db)) throw new Error("MUTATION_REQUIRED");
    return this.ctx.db;
  }
  private organization(id: string) {
    if (id !== this.scope.organizationId) throw new DiscoveryForbiddenError();
  }
  async context(userId: string) {
    return userId === this.scope.userId
      ? { organizationId: this.scope.organizationId, role: this.scope.role }
      : null;
  }
  async company(organizationId: string, id: string) {
    this.organization(organizationId);
    const company = await this.ctx.db
      .query("companies")
      .withIndex("by_organizationId_id", (q) => q.eq("organizationId", organizationId).eq("id", id))
      .unique();
    return company?.deletedAt === null ? mapCompany(company) : null;
  }
  private async document(organizationId: string, id: string) {
    this.organization(organizationId);
    const doc = await this.ctx.db
      .query("discovery_sessions")
      .withIndex("by_business_id", (q) => q.eq("id", id))
      .unique();
    return doc?.organizationId === organizationId ? doc : null;
  }
  async session(organizationId: string, id: string): Promise<DiscoveryRecord | null> {
    const doc = await this.document(organizationId, id);
    if (!doc || !(await this.company(organizationId, doc.companyId))) return null;
    const answers = await this.ctx.db
      .query("discovery_answers")
      .withIndex("by_discoverySessionId_fieldKey", (q) => q.eq("discoverySessionId", id))
      .take(7);
    if (answers.length > 6) throw new DiscoveryValidationError("Ambiguous discovery answers");
    if (answers.some((answer) => answer.organizationId !== organizationId))
      throw new DiscoveryForbiddenError();
    return { ...modelRecord(doc), answers: answers.map((answer) => modelRecord(answer)) };
  }
  async latest(organizationId: string, companyId: string) {
    this.organization(organizationId);
    const docs = await this.ctx.db
      .query("discovery_sessions")
      .withIndex("by_organizationId_companyId", (q) =>
        q.eq("organizationId", organizationId).eq("companyId", companyId),
      )
      .take(101);
    if (docs.length > 100) throw new ConvexError({ code: "PILOT_CAPACITY_LIMIT", status: 409 });
    const latest = docs
      .filter((doc) => doc.status !== "archived")
      .sort((a, b) => b.version - a.version)[0];
    return latest ? this.session(organizationId, latest.id) : null;
  }
  async create(organizationId: string, companyId: string, userId: string, version: number) {
    this.organization(organizationId);
    if (userId !== this.scope.userId) throw new DiscoveryForbiddenError();
    if (!(await this.company(organizationId, companyId))) throw new DiscoveryNotFoundError();
    const existing = await this.latest(organizationId, companyId);
    if (existing) return existing;
    const id = businessId(),
      now = new Date().toISOString();
    await this.writer().insert("discovery_sessions", {
      legacyKey: JSON.stringify([id]),
      id,
      organizationId,
      companyId,
      status: "draft",
      currentStep: "company",
      version,
      lockVersion: 1,
      startedBy: userId,
      completedAt: null,
      validatedAt: null,
      validatedBy: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    return (await this.session(organizationId, id))!;
  }
  async save(
    organizationId: string,
    id: string,
    userId: string,
    lockVersion: number,
    payload: DiscoveryPayload,
  ) {
    const doc = await this.document(organizationId, id);
    if (!doc || !(await this.company(organizationId, doc.companyId)))
      throw new DiscoveryNotFoundError();
    if (userId !== this.scope.userId) throw new DiscoveryForbiddenError();
    if (
      doc.lockVersion !== lockVersion ||
      !["draft", "in_progress", "completed"].includes(doc.status)
    )
      throw new DiscoveryConflictError();
    const now = new Date().toISOString(),
      fieldKey = `discovery.${payload.step}`;
    const existing = await this.ctx.db
      .query("discovery_answers")
      .withIndex("by_discoverySessionId_fieldKey", (q) =>
        q.eq("discoverySessionId", id).eq("fieldKey", fieldKey),
      )
      .unique();
    if (existing && existing.organizationId !== organizationId) throw new DiscoveryForbiddenError();
    const valueJson = JSON.parse(JSON.stringify(payload));
    if (existing)
      await this.writer().patch(existing._id, {
        valueJson,
        step: payload.step,
        answeredBy: userId,
        updatedAt: now,
      });
    else {
      const answerId = businessId();
      await this.writer().insert("discovery_answers", {
        legacyKey: JSON.stringify([answerId]),
        id: answerId,
        organizationId,
        discoverySessionId: id,
        step: payload.step,
        fieldKey,
        valueJson,
        answeredBy: userId,
        createdAt: now,
        updatedAt: now,
      });
    }
    await this.materialize(organizationId, doc.companyId, payload, now);
    await this.writer().patch(doc._id, {
      lockVersion: lockVersion + 1,
      currentStep: payload.step,
      status: payload.step === "review" ? "completed" : "in_progress",
      completedAt: payload.step === "review" ? now : doc.completedAt,
      updatedAt: now,
    });
    return this.session(organizationId, id);
  }
  private base(organizationId: string, companyId: string, now: string) {
    const id = businessId();
    return {
      legacyKey: JSON.stringify([id]),
      id,
      organizationId,
      companyId,
      createdAt: now,
      updatedAt: now,
    };
  }
  private async clear(table: MaterialTable, organizationId: string, companyId: string) {
    const rows = await this.ctx.db
      .query(table)
      .withIndex("by_organizationId_companyId", (q) =>
        q.eq("organizationId", organizationId).eq("companyId", companyId),
      )
      .take(501);
    if (rows.length > 500) throw new ConvexError({ code: "PILOT_CAPACITY_LIMIT", status: 409 });
    for (const row of rows) await this.writer().delete(row._id);
  }
  private async profile(
    organizationId: string,
    companyId: string,
    changes: ProfileChanges,
    now: string,
  ) {
    const existing = await this.ctx.db
      .query("company_profiles")
      .withIndex("by_organizationId_companyId", (q) =>
        q.eq("organizationId", organizationId).eq("companyId", companyId),
      )
      .unique();
    if (existing) {
      await this.writer().patch(existing._id, { ...changes, updatedAt: now });
      return;
    }
    await this.writer().insert("company_profiles", {
      legacyKey: JSON.stringify([companyId]),
      companyId,
      organizationId,
      industry: null,
      countryCode: null,
      revenueAmount: null,
      revenueCurrency: null,
      revenueYear: null,
      businessModel: null,
      growthStage: null,
      employeeCount: null,
      metadataJson: {},
      createdAt: now,
      updatedAt: now,
      ...changes,
    });
  }
  private async materialize(
    organizationId: string,
    companyId: string,
    payload: DiscoveryPayload,
    now: string,
  ) {
    if (payload.step === "company")
      await this.profile(
        organizationId,
        companyId,
        {
          industry: payload.industry,
          countryCode: payload.countryCode,
          employeeCount: payload.employeeCount,
          metadataJson: { description: payload.description ?? null },
        },
        now,
      );
    if (payload.step === "business") {
      await this.profile(
        organizationId,
        companyId,
        {
          businessModel: payload.businessModel,
          growthStage: payload.growthStage,
          revenueAmount: discoveryDecimal(payload.revenueAmount, 18),
          revenueCurrency: payload.revenueCurrency,
          revenueYear: payload.revenueYear,
        },
        now,
      );
      await this.clear("company_offerings", organizationId, companyId);
      await this.clear("company_objectives", organizationId, companyId);
      await this.clear("business_challenges", organizationId, companyId);
      for (const item of payload.offerings)
        await this.writer().insert("company_offerings", {
          ...this.base(organizationId, companyId, now),
          type: item.type,
          name: item.name,
          description: item.description ?? null,
          active: true,
        });
      for (const item of payload.objectives)
        await this.writer().insert("company_objectives", {
          ...this.base(organizationId, companyId, now),
          title: item.title,
          description: item.description ?? null,
          priority: item.priority,
          targetDate: item.targetDate ? `${item.targetDate}T00:00:00.000Z` : null,
        });
      for (const item of payload.challenges)
        await this.writer().insert("business_challenges", {
          ...this.base(organizationId, companyId, now),
          title: item.title,
          description: item.description ?? null,
          severity: item.severity,
        });
    }
    if (payload.step === "organization") {
      await this.clear("company_roles", organizationId, companyId);
      await this.clear("departments", organizationId, companyId);
      const departments = new Map<string, string>();
      for (const item of payload.departments) {
        if (departments.has(item.clientId))
          throw new DiscoveryValidationError("Duplicate department identifier");
        const row = {
          ...this.base(organizationId, companyId, now),
          name: item.name,
          description: item.description ?? null,
          headcount: item.headcount,
        };
        await this.writer().insert("departments", row);
        departments.set(item.clientId, row.id);
      }
      for (const item of payload.roles) {
        if (item.departmentClientId && !departments.has(item.departmentClientId))
          throw new DiscoveryValidationError("Unknown department reference");
        await this.writer().insert("company_roles", {
          ...this.base(organizationId, companyId, now),
          departmentId: item.departmentClientId ? departments.get(item.departmentClientId)! : null,
          title: item.title,
          headcount: item.headcount,
          responsibilitiesJson: item.responsibilities,
        });
      }
    }
    if (payload.step === "software") {
      await this.clear("company_software", organizationId, companyId);
      for (const item of payload.items)
        await this.writer().insert("company_software", {
          ...this.base(organizationId, companyId, now),
          softwareId: null,
          customName: item.name,
          purpose: item.purpose ?? null,
          criticality: item.criticality,
          usersCount: item.usersCount,
          metadataJson: {},
        });
    }
    if (payload.step === "processes") {
      await this.clear("business_processes", organizationId, companyId);
      const [systemCategories, organizationCategories] = await Promise.all([
        this.ctx.db
          .query("process_categories")
          .withIndex("by_organizationId", (q) => q.eq("organizationId", null))
          .take(501),
        this.ctx.db
          .query("process_categories")
          .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
          .take(501),
      ]);
      const categories = [...systemCategories, ...organizationCategories];
      if (categories.length > 500)
        throw new ConvexError({ code: "PILOT_CAPACITY_LIMIT", status: 409 });
      const byCode = new Map(
        categories
          .filter(
            (category) =>
              category.organizationId === null || category.organizationId === organizationId,
          )
          .sort((a, b) => Number(a.organizationId !== null) - Number(b.organizationId !== null))
          .map((category) => [category.code, category.id]),
      );
      for (const item of payload.items)
        await this.writer().insert("business_processes", {
          ...this.base(organizationId, companyId, now),
          categoryId: byCode.get(item.categoryCode) ?? null,
          departmentId: null,
          name: item.name,
          description: item.description ?? null,
          frequency: item.frequency,
          volume: discoveryDecimal(item.volume, 14),
          manualHoursMonth: discoveryDecimal(item.manualHoursMonth, 12),
          painPointsJson: item.painPoints,
          metadataJson: {},
        });
    }
  }
  async validate(organizationId: string, id: string, userId: string) {
    const doc = await this.document(organizationId, id);
    if (!doc) throw new DiscoveryNotFoundError();
    if (userId !== this.scope.userId) throw new DiscoveryForbiddenError();
    if (doc.status !== "completed") throw new DiscoveryConflictError();
    const now = new Date().toISOString();
    await this.writer().patch(doc._id, {
      status: "validated",
      validatedAt: now,
      validatedBy: userId,
      lockVersion: doc.lockVersion + 1,
      updatedAt: now,
    });
    return (await this.session(organizationId, id))!;
  }
  async archive(organizationId: string, id: string) {
    const doc = await this.document(organizationId, id);
    if (!doc) throw new DiscoveryNotFoundError();
    const now = new Date().toISOString();
    await this.writer().patch(doc._id, {
      status: "archived",
      archivedAt: now,
      lockVersion: doc.lockVersion + 1,
      updatedAt: now,
    });
    return (await this.session(organizationId, id))!;
  }
}
