import type { AssistedAuditReadModel } from "@/modules/assisted-audit/application/assisted-audit-model";
import { customerJourneyRoutes } from "@/modules/assisted-audit/presentation/canonical-journey";

export function companyIdFromPath(pathname: string): string | null {
  return (
    pathname.match(
      /^\/companies\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i,
    )?.[1] ?? null
  );
}

export function companyNavigationHref(
  companyId: string | null,
  model: AssistedAuditReadModel | null,
  label: string,
  fallback: string,
): string {
  if (!companyId) return fallback;
  const routes = customerJourneyRoutes(companyId, model?.company.id === companyId ? model : null);
  switch (label) {
    case "Mon entreprise":
      return `/companies/${companyId}`;
    case "Audit":
      return routes.audit;
    case "Opportunités":
      return routes.opportunities;
    case "ROI":
      return routes.roi;
    case "Plan d’action":
      return routes.actionPlan;
    case "Résultats":
      return routes.results;
    default:
      return fallback;
  }
}

export async function loadCompanyNavigation(
  companyId: string,
  signal: AbortSignal,
): Promise<AssistedAuditReadModel | null> {
  const response = await fetch(`/api/companies/${companyId}/automation-audit`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { data?: AssistedAuditReadModel };
  return payload.data?.company.id === companyId ? payload.data : null;
}
