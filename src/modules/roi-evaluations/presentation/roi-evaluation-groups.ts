import type { RoiTrace } from "./roi-trace";

type Evaluation = { id: string; scenarioId: string; confidence: number };
type Metric = {
  evaluationId: string;
  code: string;
  value: number | null;
  specialValue: string | null;
  unit: string;
};

/** Presentation only: identical numbers alone never establish shared assumptions. */
export function groupRoiEvaluations<T extends Evaluation>(
  evaluations: readonly T[],
  metrics: readonly Metric[],
  traces: readonly RoiTrace[],
): T[][] {
  const groups: T[][] = [];
  const bySignature = new Map<string, T[]>();
  for (const evaluation of evaluations) {
    const trace = traces.find((row) => row.evaluationId === evaluation.id);
    const values = metrics.filter((row) => row.evaluationId === evaluation.id);
    const canGroup =
      trace &&
      trace.sharedEvaluationCount > 1 &&
      trace.assumptions.length > 0 &&
      trace.volumeFactor != null &&
      trace.costFactor != null &&
      Number.isFinite(trace.volumeFactor) &&
      Number.isFinite(trace.costFactor) &&
      trace.assumptions.every(
        (row) =>
          row.value !== null &&
          Number.isFinite(row.value) &&
          ["provided", "catalog_default"].includes(row.source),
      ) &&
      values.length > 0 &&
      values.every((row) => row.value !== null && Number.isFinite(row.value) && !row.specialValue);
    const signature = canGroup
      ? JSON.stringify([
          evaluation.scenarioId,
          evaluation.confidence,
          trace.volumeFactor,
          trace.costFactor,
          trace.assumptions
            .map(({ code, value, unit, source }) => [code, value, unit, source])
            .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
          values
            .map(({ code, value, unit }) => [code, value, unit])
            .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
        ])
      : null;
    const existing = signature ? bySignature.get(signature) : undefined;
    if (existing) existing.push(evaluation);
    else {
      const group = [evaluation];
      groups.push(group);
      if (signature) bySignature.set(signature, group);
    }
  }
  return groups;
}
