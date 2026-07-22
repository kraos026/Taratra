import type { OrganizationRole } from "./company";

const editors: readonly OrganizationRole[] = ["owner", "admin", "consultant"];
const administrators: readonly OrganizationRole[] = ["owner", "admin"];

export function canWriteCompanies(role: OrganizationRole): boolean {
  return editors.includes(role);
}

export function canPermanentlyDeleteCompanies(role: OrganizationRole): boolean {
  return administrators.includes(role);
}
