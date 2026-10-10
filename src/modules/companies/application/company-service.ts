import type {
  CompanyInput,
  CompanyListQuery,
  CompanyPage,
  CompanyUpdate,
  OrganizationContext,
} from "../domain/company";
import {
  CompanyDependencyError,
  CompanyNotFoundError,
  CompanyPermissionError,
} from "../domain/company-errors";
import { canPermanentlyDeleteCompanies, canWriteCompanies } from "../domain/company-permissions";
import type { CompanyRepository } from "./company-repository";

export class CompanyService {
  constructor(
    private readonly repository: CompanyRepository,
    private readonly userId: string,
  ) {}

  async list(query: CompanyListQuery): Promise<CompanyPage> {
    const context = await this.requireContext();
    const result = await this.repository.list(context.organizationId, query);
    return {
      ...result,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(result.total / query.pageSize)),
      permissions: {
        canWrite: canWriteCompanies(context.role),
        canDelete: canPermanentlyDeleteCompanies(context.role),
      },
    };
  }

  async permissions() {
    const context = await this.requireContext();
    return {
      canWrite: canWriteCompanies(context.role),
      canDelete: canPermanentlyDeleteCompanies(context.role),
    };
  }

  async get(id: string) {
    const context = await this.requireContext();
    const company = await this.repository.findById(context.organizationId, id);
    if (!company) throw new CompanyNotFoundError();
    return company;
  }

  async create(input: CompanyInput) {
    const context = await this.requireEditor();
    return this.repository.create(context.organizationId, input);
  }

  async exportProfile(id: string) {
    const context = await this.requireContext();
    if (!canPermanentlyDeleteCompanies(context.role)) throw new CompanyPermissionError();
    const company = await this.repository.findById(context.organizationId, id);
    // Defense in depth: fail closed even if an adapter returns a different tenant.
    if (!company || company.organizationId !== context.organizationId || company.id !== id)
      throw new CompanyNotFoundError();
    return {
      formatVersion: 1,
      scope: "company_profile_only",
      description: "Profil entreprise uniquement ; ceci n’est pas un export complet du compte.",
      excluded: ["auth", "audits_and_results", "provider_logs", "backups"],
      company: {
        id: company.id,
        name: company.name,
        sectorId: company.sectorId,
        employeeCount: company.employeeCount,
        companySize: company.companySize,
        primaryContactName: company.primaryContactName,
        primaryContactRole: company.primaryContactRole,
        phone: company.phone,
        email: company.email,
        website: company.website,
        address: company.address,
        city: company.city,
        country: company.country,
        description: company.description,
        internalNotes: company.internalNotes,
        status: company.status,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
        archivedAt: company.deletedAt,
      },
    };
  }

  async update(id: string, input: CompanyUpdate) {
    const context = await this.requireEditor();
    const company = await this.repository.update(context.organizationId, id, input);
    if (!company) throw new CompanyNotFoundError();
    return company;
  }

  async archive(id: string) {
    const context = await this.requireEditor();
    const company = await this.repository.archive(context.organizationId, id);
    if (!company) throw new CompanyNotFoundError();
    return company;
  }

  async restore(id: string) {
    const context = await this.requireEditor();
    const company = await this.repository.restore(context.organizationId, id);
    if (!company) throw new CompanyNotFoundError();
    return company;
  }

  async permanentlyDelete(id: string): Promise<void> {
    const context = await this.requireContext();
    if (!canPermanentlyDeleteCompanies(context.role)) throw new CompanyPermissionError();

    try {
      if (!(await this.repository.delete(context.organizationId, id)))
        throw new CompanyNotFoundError();
    } catch (error) {
      if (error instanceof CompanyNotFoundError) throw error;
      throw new CompanyDependencyError();
    }
  }

  private async requireContext(): Promise<OrganizationContext> {
    const context = await this.repository.getOrganizationContext(this.userId);
    if (!context) throw new CompanyPermissionError();
    return context;
  }

  private async requireEditor(): Promise<OrganizationContext> {
    const context = await this.requireContext();
    if (!canWriteCompanies(context.role)) throw new CompanyPermissionError();
    return context;
  }
}
