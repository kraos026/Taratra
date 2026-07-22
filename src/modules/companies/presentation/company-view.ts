import type { Company, CompanyPermissions } from "../domain/company";

export type CompanyView = Omit<Company, "createdAt" | "updatedAt" | "deletedAt"> & {
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
};

export interface CompanyDetailResponse {
  readonly company: CompanyView;
  readonly permissions: CompanyPermissions;
}
