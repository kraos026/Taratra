export function agentLabVisible(): boolean {
  return process.env.NEXT_PUBLIC_OPTIVOS_ATELIER_IA_LAB === "1";
}

export function agentLabEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (
    env.NEXT_PUBLIC_OPTIVOS_ATELIER_IA_LAB === "1" &&
    env.VERCEL_ENV !== "production" &&
    env.AUTOMATEX_CERTIFICATION_TARGET !== "production" &&
    (env.VERCEL_ENV === "preview" || env.AUTOMATEX_CERTIFICATION_TARGET === "local")
  );
}

export function agentWorkspaceHref(companyId?: string | null): string {
  return companyId ? `/companies/${encodeURIComponent(companyId)}/atelier-ia` : "/atelier-ia";
}

export const agentExecutionPolicy = Object.freeze({
  status: "SHADOW",
  mode: "real-monitoring",
  budgetEuro: 0,
  liveEnabled: false,
  persistence: "company-scoped-registry",
} as const);
