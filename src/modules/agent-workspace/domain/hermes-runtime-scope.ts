/** A standalone AI company and an audit dossier have distinct runtime bindings. */
export type HermesRuntimeScope = string | { workspaceId: string };
export type HermesPanelScope =
  { companyId: string; workspaceId?: never } | { workspaceId: string; companyId?: never };

export function hermesConsultationPath(scope: HermesPanelScope) {
  return scope.workspaceId !== undefined
    ? `/api/atelier-ia/entreprises/${encodeURIComponent(scope.workspaceId)}`
    : `/api/companies/${encodeURIComponent(scope.companyId)}/atelier-ia`;
}
