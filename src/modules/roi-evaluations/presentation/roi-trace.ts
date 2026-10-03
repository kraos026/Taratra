export type RoiTrace = {
  evaluationId: string;
  sharedEvaluationCount: number;
  sourceReferenceCount: number;
  assumptions: { code: string; value: number | null; unit: string; source: string }[];
};

type Numeric = number | string | { toString(): string };
type Detail = {
  evaluations: readonly { id: string; scenarioId: string }[];
  contributions: readonly {
    evaluationId: string;
    scenarioId: string;
    assumptionId: string;
    code: string;
    inputValue: Numeric;
  }[];
  assumptions: readonly {
    scenarioId: string;
    assumptionId: string;
    value: Numeric;
    unit: string;
    source: string;
  }[];
  evidence: readonly { evaluationId: string; scenarioId: string; knowledgeFactId: string }[];
};

/** Render-only projection of the authenticated detail. No new economic facts or evidence. */
export function roiTraces(detail: Detail): RoiTrace[] {
  return detail.evaluations.map((evaluation) => ({
    evaluationId: evaluation.id,
    sharedEvaluationCount: detail.evaluations.filter(
      (other) => other.scenarioId === evaluation.scenarioId,
    ).length,
    sourceReferenceCount: new Set(
      detail.evidence
        .filter(
          (row) => row.evaluationId === evaluation.id && row.scenarioId === evaluation.scenarioId,
        )
        .map((row) => row.knowledgeFactId),
    ).size,
    assumptions: detail.contributions
      .filter(
        (row) => row.evaluationId === evaluation.id && row.scenarioId === evaluation.scenarioId,
      )
      .map((row) => {
        const frozen = detail.assumptions.find(
          (item) =>
            item.scenarioId === evaluation.scenarioId && item.assumptionId === row.assumptionId,
        );
        const value = Number(row.inputValue);
        const aligned = Number.isFinite(value) && frozen && Number(frozen.value) === value;
        return {
          code: row.code,
          value: Number.isFinite(value) ? value : null,
          unit: aligned ? frozen.unit : "",
          source: aligned ? frozen.source : "unknown",
        };
      }),
  }));
}
