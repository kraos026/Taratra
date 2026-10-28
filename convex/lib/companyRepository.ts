import type { CompanyRepository } from "../../src/modules/companies/application/company-repository";
import type {
  Company,
  CompanyInput,
  CompanyListQuery,
  CompanyUpdate,
} from "../../src/modules/companies/domain/company";
import { companySizes, companyStatuses } from "../../src/modules/companies/domain/company";
import {
  CompanyDependencyError,
  CompanyPermissionError,
} from "../../src/modules/companies/domain/company-errors";
import type { Doc } from "../_generated/dataModel";
import type { DatabaseCtx, TrustedContext } from "./access";
import { businessId } from "./businessId";

export function mapCompany(doc: Doc<"companies">): Company {
  return {
    id: doc.id,
    organizationId: doc.organizationId,
    name: doc.name,
    sectorId: doc.sectorId,
    employeeCount: doc.employeeCount,
    companySize: doc.companySize,
    primaryContactName: doc.primaryContactName,
    primaryContactRole: doc.primaryContactRole,
    phone: doc.phone,
    email: doc.email,
    website: doc.website,
    address: doc.address,
    city: doc.city,
    country: doc.country,
    description: doc.description,
    internalNotes: doc.internalNotes,
    status: doc.status,
    createdAt: new Date(doc.createdAt),
    updatedAt: new Date(doc.updatedAt),
    deletedAt: doc.deletedAt === null ? null : new Date(doc.deletedAt),
  };
}
// These are business identifiers, never credentials. Math.random is deterministic in Convex mutations.
export class ConvexCompanyRepository implements CompanyRepository {
  constructor(
    private readonly ctx: DatabaseCtx,
    private readonly scope: TrustedContext,
  ) {}
  private assertOrganization(id: string) {
    if (id !== this.scope.organizationId) throw new CompanyPermissionError();
  }
  private writer() {
    if (!("insert" in this.ctx.db)) throw new Error("MUTATION_REQUIRED");
    return this.ctx.db;
  }
  async getOrganizationContext(userId: string) {
    return userId === this.scope.userId
      ? { organizationId: this.scope.organizationId, role: this.scope.role }
      : null;
  }
  async list(organizationId: string, query: CompanyListQuery) {
    this.assertOrganization(organizationId);
    const documents = await this.ctx.db
      .query("companies")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
      .take(1001);
    if (documents.length > 1000) throw new Error("MIGRATION_PAGINATION_LIMIT");
    const search = query.search?.toLocaleLowerCase("fr");
    const items = documents
      .filter(
        (doc) =>
          (query.includeArchived || doc.deletedAt === null) &&
          (!query.status || doc.status === query.status) &&
          (!query.companySize || doc.companySize === query.companySize) &&
          (!query.sectorId || doc.sectorId === query.sectorId) &&
          (!search ||
            [doc.name, doc.primaryContactName, doc.email, doc.city, doc.sectorId].some((value) =>
              value?.toLocaleLowerCase("fr").includes(search),
            )),
      )
      .map(mapCompany);
    items.sort((a, b) => {
      const left = a[query.sortBy],
        right = b[query.sortBy];
      const ranks: readonly string[] | undefined =
        query.sortBy === "status"
          ? companyStatuses
          : query.sortBy === "companySize"
            ? companySizes
            : undefined;
      const order =
        left === right
          ? 0
          : left === null
            ? 1
            : right === null
              ? -1
              : left instanceof Date && right instanceof Date
                ? left.getTime() - right.getTime()
                : ranks
                  ? ranks.indexOf(String(left)) - ranks.indexOf(String(right))
                  : String(left).localeCompare(String(right), "fr");
      return (query.sortOrder === "asc" ? order : -order) || a.id.localeCompare(b.id);
    });
    return {
      items: items.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
      total: items.length,
    };
  }
  private async document(organizationId: string, id: string) {
    this.assertOrganization(organizationId);
    const doc = await this.ctx.db
      .query("companies")
      .withIndex("by_organizationId_id", (q) => q.eq("organizationId", organizationId).eq("id", id))
      .unique();
    return doc;
  }
  async findById(organizationId: string, id: string) {
    const doc = await this.document(organizationId, id);
    return doc ? mapCompany(doc) : null;
  }
  async create(organizationId: string, input: CompanyInput) {
    this.assertOrganization(organizationId);
    const now = new Date().toISOString(),
      id = businessId();
    if (
      await this.ctx.db
        .query("companies")
        .withIndex("by_business_id", (q) => q.eq("id", id))
        .first()
    )
      throw new Error("IDENTIFIER_COLLISION");
    const value = {
      legacyKey: JSON.stringify([id]),
      id,
      organizationId,
      name: input.name,
      status: input.status,
      sectorId: input.sectorId ?? null,
      employeeCount: input.employeeCount ?? null,
      companySize: input.companySize ?? null,
      primaryContactName: input.primaryContactName ?? null,
      primaryContactRole: input.primaryContactRole ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      website: input.website ?? null,
      address: input.address ?? null,
      city: input.city ?? null,
      country: input.country ?? null,
      description: input.description ?? null,
      internalNotes: input.internalNotes ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    const nativeId = await this.writer().insert("companies", value);
    const doc = await this.ctx.db.get(nativeId);
    if (!doc) throw new Error("INSERT_NOT_VISIBLE");
    return mapCompany(doc);
  }
  async update(organizationId: string, id: string, input: CompanyUpdate) {
    const doc = await this.document(organizationId, id);
    if (!doc) return null;
    const values = Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, value ?? null]),
    );
    await this.writer().patch(doc._id, { ...values, updatedAt: new Date().toISOString() });
    return this.findById(organizationId, id);
  }
  async archive(organizationId: string, id: string) {
    const doc = await this.document(organizationId, id);
    if (!doc || doc.deletedAt !== null) return null;
    const now = new Date().toISOString();
    await this.writer().patch(doc._id, { deletedAt: now, updatedAt: now });
    return this.findById(organizationId, id);
  }
  async restore(organizationId: string, id: string) {
    const doc = await this.document(organizationId, id);
    if (!doc || doc.deletedAt === null) return null;
    await this.writer().patch(doc._id, { deletedAt: null, updatedAt: new Date().toISOString() });
    return this.findById(organizationId, id);
  }
  async delete(organizationId: string): Promise<boolean> {
    this.assertOrganization(organizationId);
    throw new CompanyDependencyError();
  }
}
