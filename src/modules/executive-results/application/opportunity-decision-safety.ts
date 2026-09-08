import type { ExecutiveAuditResult } from "./executive-result-model";

/** Safety constraints on the existing executive projection, not a publishing engine. */
export function opportunityDecisionSafety(result: ExecutiveAuditResult, opportunity: ExecutiveAuditResult["opportunities"][number], organizationId: string) {
  const safety = opportunity.safety;
  const missing: string[] = [];
  const contradictions: string[] = [];
  if (!safety || safety.organizationId !== organizationId || safety.companyId !== result.company.id || safety.opportunityId !== opportunity.id || safety.automationSnapshotId !== result.provenance?.automationOpportunitySnapshotId || safety.prerequisites.some(item => item.opportunityId !== opportunity.id)) {
    return { state: "NEEDS_MORE_EVIDENCE" as const, missing: ["Les preuves et prérequis doivent être reliés à cette opportunité et à cet audit."], contradictions, evidenceIds: [] as string[], remediations: [] as string[] };
  }
  const supported = safety.evidence.filter(item => item.quality === "SUPPORTED");
  if (!supported.length || safety.evidence.some(item => ["MISSING", "INFERRED", "ASSUMED"].includes(item.quality))) missing.push("Des preuves vérifiées sont nécessaires pour confirmer cette opportunité.");
  if (safety.evidence.some(item => item.quality === "CONTRADICTORY")) contradictions.push("Les preuves liées à cette opportunité se contredisent.");
  const comparable = new Map<string, typeof safety.observations>();
  for (const fact of safety.observations) {
    if (!["SUPPORTED", "ASSUMED"].includes(fact.quality)) continue;
    const key = `${fact.key}:${fact.unit ?? ""}`;
    comparable.set(key, [...(comparable.get(key) ?? []), fact]);
  }
  for (const [key, facts] of comparable) {
    if (facts.some(fact => fact.quality === "SUPPORTED") && new Set(facts.map(fact => JSON.stringify(fact.value))).size > 1) contradictions.push(`Valeurs incompatibles pour ${key} (${facts.map(fact => fact.factId).join(", ")}).`);
  }
  const known = (key: string, value: string | boolean) => safety.observations.some(fact => fact.key === key && fact.value === value && fact.quality === "SUPPORTED");
  if (known("human_approval_required", true) && known("execution_policy", "fully_automatic")) contradictions.push("Une approbation humaine est requise mais le mode proposé est entièrement automatique.");
  const unresolved = safety.prerequisites.filter(item => item.satisfied !== true);
  const remediations = unresolved.map(item => item.remediation.trim()).filter(Boolean);
  if (unresolved.length !== remediations.length) missing.push("La mesure corrective d’un prérequis bloquant doit être précisée.");
  const state = known("automation_allowed", false) ? "DO_NOT_AUTOMATE" as const
    : contradictions.length ? "INVESTIGATE_FIRST" as const
    : missing.length ? "NEEDS_MORE_EVIDENCE" as const
    : unresolved.some(item => item.kind === "human_approval") ? "HUMAN_DECISION_REQUIRED" as const
    : unresolved.length ? "FIX_BEFORE_AUTOMATING" as const : null;
  return { state, missing, contradictions, evidenceIds: supported.map(item => item.id), remediations };
}
