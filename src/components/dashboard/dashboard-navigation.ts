export const dashboardRoutes = Object.freeze({
  overview: "/",
  companies: "/companies",
  crm: "/companies?view=crm",
  audits: "/audits",
  recommendations: "/recommendations",
  reports: "/reports",
  knowledge: "/questionnaires",
  settings: "/settings",
  newAudit: "/audits/new",
} as const);

export function companyRoute(companyId: string): string {
  return `/companies/${encodeURIComponent(companyId)}`;
}

export function dashboardSearchRoute(value: string): string {
  const query = value.trim();
  return query ? `/companies?search=${encodeURIComponent(query)}` : dashboardRoutes.companies;
}
