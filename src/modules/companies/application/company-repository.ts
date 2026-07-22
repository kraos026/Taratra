import type {
  Company,
  CompanyInput,
  CompanyListQuery,
  CompanyUpdate,
  OrganizationContext,
} from "../domain/company";

export interface CompanyRepository {
  getOrganizationContext(userId: string): Promise<OrganizationContext | null>;
  list(
    organizationId: string,
    query: CompanyListQuery,
  ): Promise<{ items: readonly Company[]; total: number }>;
  findById(organizationId: string, id: string): Promise<Company | null>;
  create(organizationId: string, input: CompanyInput): Promise<Company>;
  update(organizationId: string, id: string, input: CompanyUpdate): Promise<Company | null>;
  archive(organizationId: string, id: string): Promise<Company | null>;
  restore(organizationId: string, id: string): Promise<Company | null>;
  delete(organizationId: string, id: string): Promise<boolean>;
}
