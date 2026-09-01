export const dashboardRoutes = Object.freeze({
  overview: "/",
  companies: "/companies",
  audit: "/companies",
  opportunities: "/recommendations",
  roi: "/companies",
  actionPlan: "/recommendations",
  results: "/companies",
  newAudit: "/companies",
} as const);

export function companyRoute(companyId: string): string {
  return `/companies/${encodeURIComponent(companyId)}`;
}

export function dashboardSearchRoute(value: string): string {
  const query = value.trim();
  return query ? `/companies?search=${encodeURIComponent(query)}` : dashboardRoutes.companies;
}
