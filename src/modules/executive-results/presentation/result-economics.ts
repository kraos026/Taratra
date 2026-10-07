import type { ExecutiveAuditResult } from "../application/executive-result-model";

type Evaluation = NonNullable<ExecutiveAuditResult["roi"]>["evaluations"][number];

/** Match by canonical ID only, never by a translated or duplicate title. */
export function attributableEvaluation(
  result: ExecutiveAuditResult,
  evaluation: Evaluation,
): boolean {
  const id = evaluation.automationOpportunityId;
  return Boolean(
    id &&
    result.opportunities.filter((item) => item.id === id).length === 1 &&
    result.roi?.evaluations.filter((item) => item.automationOpportunityId === id).length === 1,
  );
}

/** Identical estimates warrant review, not an invented conclusion about their cause. */
export function repeatedEstimates(result: ExecutiveAuditResult): boolean {
  const seen = new Set<string>();
  for (const evaluation of result.roi?.evaluations ?? []) {
    if (
      !attributableEvaluation(result, evaluation) ||
      evaluation.annualBenefit === null ||
      !Number.isFinite(evaluation.annualBenefit)
    )
      continue;
    const signature = JSON.stringify([
      evaluation.annualBenefit,
      evaluation.implementationCost ?? null,
      evaluation.roi,
      evaluation.roiSpecialValue,
      evaluation.payback,
    ]);
    if (seen.has(signature)) return true;
    seen.add(signature);
  }
  return false;
}
