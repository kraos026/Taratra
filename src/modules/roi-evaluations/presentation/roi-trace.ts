export type RoiTrace = {
  evaluationId: string;
  sharedEvaluationCount: number;
  sourceReferenceCount: number;
  volumeFactor?: number | null;
  costFactor?: number | null;
  assumptions: { code: string; value: number | null; unit: string; source: string }[];
};

type Numeric = number | string | { toString(): string };
type Detail = {
  scenarios?: readonly { id: string; volumeFactor: Numeric; costFactor: Numeric }[];
  evaluations: readonly { id: string; scenarioId: string }[];
  contributions: readonly {
    evaluationId: string;
    scenarioId: string;
    assumptionId: string;
    code: string;
    inputValue: Numeric;
    calculationJson?: unknown;
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
    volumeFactor: factor(
      detail.scenarios?.find((row) => row.id === evaluation.scenarioId)?.volumeFactor,
    ),
    costFactor: factor(
      detail.scenarios?.find((row) => row.id === evaluation.scenarioId)?.costFactor,
    ),
    sharedEvaluationCount: detail.contributions.some(
      (row) =>
        row.evaluationId === evaluation.id &&
        row.scenarioId === evaluation.scenarioId &&
        activityCalculation(row.calculationJson)?.scope === "activity",
    )
      ? 1
      : detail.evaluations.filter((other) => other.scenarioId === evaluation.scenarioId).length,
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
        const calculation = activityCalculation(row.calculationJson);
        if (calculation?.scope === "activity") {
          const valid =
            Number.isFinite(value) &&
            value >= 0 &&
            calculation.source === "provided" &&
            typeof calculation.unit === "string" &&
            calculation.unit.length > 0;
          return {
            code: row.code,
            value: Number.isFinite(value) ? value : null,
            unit: valid ? (calculation.unit as string) : "",
            source: valid ? "provided" : "unknown",
          };
        }
        return {
          code: row.code,
          value: Number.isFinite(value) ? value : null,
          unit: aligned ? frozen.unit : "",
          source: aligned ? frozen.source : "unknown",
        };
      }),
  }));
}

function activityCalculation(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function factor(value: Numeric | undefined): number | null {
  return value !== undefined && Number.isFinite(Number(value)) ? Number(value) : null;
}
