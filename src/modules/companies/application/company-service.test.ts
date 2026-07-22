import { beforeEach, describe, expect, it } from "vitest";
import type { CompanyRepository } from "./company-repository";
import { CompanyService } from "./company-service";
import type {
  Company,
  CompanyInput,
  CompanyListQuery,
  CompanyUpdate,
  OrganizationContext,
} from "../domain/company";

const baseCompany: Company = {
  id: "00000000-0000-4000-8000-000000000001",
  organizationId: "00000000-0000-4000-8000-000000000010",
  name: "Nova",
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
  internalNotes: null,
  status: "prospect",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  deletedAt: null,
};

class FakeCompanyRepository implements CompanyRepository {
  context: OrganizationContext | null = {
    organizationId: baseCompany.organizationId,
    role: "consultant",
  };
  company: Company | null = baseCompany;
  lastQuery?: CompanyListQuery;

  async getOrganizationContext() {
    return this.context;
  }
  async list(_organizationId: string, query: CompanyListQuery) {
    this.lastQuery = query;
    return { items: this.company ? [this.company] : [], total: this.company ? 1 : 0 };
  }
  async findById() {
    return this.company;
  }
  async create(_organizationId: string, input: CompanyInput) {
    this.company = { ...baseCompany, ...input };
    return this.company;
  }
  async update(_organizationId: string, _id: string, input: CompanyUpdate) {
    this.company = this.company ? { ...this.company, ...input } : null;
    return this.company;
  }
  async archive() {
    this.company = this.company ? { ...this.company, deletedAt: new Date() } : null;
    return this.company;
  }
  async restore() {
    this.company = this.company ? { ...this.company, deletedAt: null } : null;
    return this.company;
  }
  async delete() {
    const existed = Boolean(this.company);
    this.company = null;
    return existed;
  }
}

describe("CompanyService", () => {
  let repository: FakeCompanyRepository;
  let service: CompanyService;

  beforeEach(() => {
    repository = new FakeCompanyRepository();
    service = new CompanyService(repository, "user-id");
  });

  it("creates and updates a company in the resolved organization", async () => {
    expect((await service.create({ name: "Created", status: "prospect" })).name).toBe("Created");
    expect((await service.update(baseCompany.id, { city: "Paris" })).city).toBe("Paris");
  });

  it("archives and restores without changing business status", async () => {
    const archived = await service.archive(baseCompany.id);
    expect(archived.deletedAt).toBeInstanceOf(Date);
    expect(archived.status).toBe("prospect");
    expect((await service.restore(baseCompany.id)).deletedAt).toBeNull();
  });

  it("returns stable pagination metadata", async () => {
    const query: CompanyListQuery = {
      page: 2,
      pageSize: 10,
      sortBy: "name",
      sortOrder: "asc",
      includeArchived: false,
    };
    const result = await service.list(query);
    expect(result).toMatchObject({ page: 2, pageSize: 10, total: 1, totalPages: 1 });
    expect(repository.lastQuery).toEqual(query);
  });

  it("keeps viewers read-only", async () => {
    repository.context = { ...repository.context!, role: "viewer" };
    await expect(service.create({ name: "Denied", status: "prospect" })).rejects.toMatchObject({
      code: "COMPANY_FORBIDDEN",
    });
    await expect(service.archive(baseCompany.id)).rejects.toMatchObject({
      code: "COMPANY_FORBIDDEN",
    });
  });

  it("allows only owners and admins to permanently delete", async () => {
    await expect(service.permanentlyDelete(baseCompany.id)).rejects.toMatchObject({
      code: "COMPANY_FORBIDDEN",
    });
    repository.context = { ...repository.context!, role: "admin" };
    await expect(service.permanentlyDelete(baseCompany.id)).resolves.toBeUndefined();
  });

  it("does not leak missing or cross-tenant records", async () => {
    repository.company = null;
    await expect(service.get(baseCompany.id)).rejects.toMatchObject({
      code: "COMPANY_NOT_FOUND",
      status: 404,
    });
  });
});
