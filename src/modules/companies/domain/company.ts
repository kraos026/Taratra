export const companySizes = ["micro", "small", "medium", "large", "enterprise"] as const;
export type CompanySize = (typeof companySizes)[number];

export const companyStatuses = [
  "prospect",
  "contacted",
  "audit_scheduled",
  "audit_in_progress",
  "client",
  "archived",
] as const;
export type CompanyStatus = (typeof companyStatuses)[number];

export const organizationRoles = ["owner", "admin", "consultant", "viewer"] as const;
export type OrganizationRole = (typeof organizationRoles)[number];

export interface Company {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly sectorId: string | null;
  readonly employeeCount: number | null;
  readonly companySize: CompanySize | null;
  readonly primaryContactName: string | null;
  readonly primaryContactRole: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly website: string | null;
  readonly address: string | null;
  readonly city: string | null;
  readonly country: string | null;
  readonly description: string | null;
  readonly internalNotes: string | null;
  readonly status: CompanyStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface CompanyInput {
  readonly name: string;
  readonly sectorId?: string;
  readonly employeeCount?: number;
  readonly companySize?: CompanySize;
  readonly primaryContactName?: string;
  readonly primaryContactRole?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly website?: string;
  readonly address?: string;
  readonly city?: string;
  readonly country?: string;
  readonly description?: string;
  readonly internalNotes?: string;
  readonly status: CompanyStatus;
}

export type CompanyUpdate = Partial<CompanyInput>;

export const companySortFields = [
  "name",
  "createdAt",
  "updatedAt",
  "status",
  "companySize",
] as const;
export type CompanySortField = (typeof companySortFields)[number];
export type SortOrder = "asc" | "desc";

export interface CompanyListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly status?: CompanyStatus;
  readonly companySize?: CompanySize;
  readonly sectorId?: string;
  readonly sortBy: CompanySortField;
  readonly sortOrder: SortOrder;
  readonly includeArchived: boolean;
}

export interface CompanyPage {
  readonly items: readonly Company[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
  readonly permissions: CompanyPermissions;
}

export interface CompanyPermissions {
  readonly canWrite: boolean;
  readonly canDelete: boolean;
}

export interface OrganizationContext {
  readonly organizationId: string;
  readonly role: OrganizationRole;
}
