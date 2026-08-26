import type {
  BenchmarkCase,
  BenchmarkDivergence,
  BenchmarkDivergenceType,
  BenchmarkScore,
  BrainShadowBenchmarkSnapshot,
  CanonicalBenchmarkSnapshot,
} from "./canonical-shadow-types";

export function classifyBenchmarkDivergences(input: {
  readonly benchmarkCase: BenchmarkCase;
  readonly canonical: CanonicalBenchmarkSnapshot;
  readonly brain: BrainShadowBenchmarkSnapshot;
  readonly canonicalScore: BenchmarkScore;
  readonly brainScore: BenchmarkScore;
}): readonly BenchmarkDivergence[] {
  const divergences: BenchmarkDivergence[] = [];
  if (input.brainScore.criticalFalsePositiveCount > 0) {
    divergences.push(
      divergence("BRAIN_FALSE_POSITIVE", "critical", 1, {
        brainRefs: input.brain.opportunityDecisions.map((item) => item.id),
        groundTruthRef: "forbiddenInventions",
        description: "Brain produced a forbidden or critical unsupported item.",
      }),
    );
  }
  const brainAdds = input.brainScore.overall > input.canonicalScore.overall + 5;
  const brainOnlySupported = input.brainScore.matchedExpectedItems.some(
    (id) => !input.canonicalScore.matchedExpectedItems.includes(id),
  );
  if (
    brainAdds &&
    brainOnlySupported &&
    input.brainScore.criticalFalsePositiveCount === 0 &&
    input.brainScore.unsupportedRoiClaimCount === 0
  ) {
    divergences.push(
      divergence("BRAIN_ADDS_VALUE", "medium", 0.8, {
        brainRefs: input.brain.opportunityDecisions.map((item) => item.id),
        groundTruthRef: "expectedItems",
        description: "Brain found supported expected material that Canonical missed.",
      }),
    );
  }
  if (input.canonicalScore.overall > input.brainScore.overall + 5) {
    divergences.push(
      divergence("CANONICAL_BETTER", "medium", 0.8, {
        canonicalRefs: input.canonical.recommendations.map((item) => item.id),
        groundTruthRef: "score",
        description: "Canonical snapshot scored materially higher than Brain Shadow.",
      }),
    );
  }
  const canonicalMissed = input.canonicalScore.missingExpectedItems.filter((id) =>
    input.brainScore.matchedExpectedItems.includes(id),
  );
  if (canonicalMissed.length) {
    divergences.push(
      divergence("CANONICAL_MISSED_ITEM", "medium", 0.8, {
        brainRefs: canonicalMissed,
        groundTruthRef: "expectedItems",
        description: `Canonical missed expected item(s): ${canonicalMissed.join(", ")}.`,
      }),
    );
  }
  if (input.canonicalScore.priorityScore !== input.brainScore.priorityScore) {
    divergences.push(
      divergence("PRIORITY_DISAGREEMENT", "high", 0.75, {
        canonicalRefs: input.canonical.recommendations.map((item) => item.id),
        brainRefs: input.brain.priorities,
        groundTruthRef: "expectedPriorityOrder",
        description: "Canonical and Brain rank priorities differently.",
      }),
    );
  }
  if (input.canonical.roi.direction !== input.brain.economicAssessment.direction) {
    divergences.push(
      divergence("ROI_DISAGREEMENT", "high", 0.85, {
        canonicalRefs: input.canonical.roi.evidenceRefs,
        brainRefs: input.brain.economicAssessment.evidenceRefs,
        groundTruthRef: "expectedRoiDirection",
        description: "Canonical and Brain disagree on ROI direction.",
      }),
    );
  }
  if (
    input.brain.unknowns.length > 0 ||
    input.brain.economicAssessment.direction === "INSUFFICIENT_EVIDENCE"
  ) {
    divergences.push(
      divergence("INSUFFICIENT_EVIDENCE", "low", 0.7, {
        brainRefs: input.brain.unknowns,
        groundTruthRef: null,
        description: "Brain preserved uncertainty or missing evidence.",
      }),
    );
  }
  if (!divergences.length) {
    divergences.push(
      divergence("AGREE", "low", 0.9, {
        canonicalRefs: input.canonical.recommendations.map((item) => item.id),
        brainRefs: input.brain.opportunityDecisions.map((item) => item.id),
        groundTruthRef: null,
        description: "Canonical and Brain materially agree.",
      }),
    );
  }
  return Object.freeze(divergences);
}

export function brainHasIncrementalValue(divergences: readonly BenchmarkDivergence[]): boolean {
  return divergences.some((item) => item.type === "BRAIN_ADDS_VALUE");
}

function divergence(
  type: BenchmarkDivergenceType,
  severity: BenchmarkDivergence["severity"],
  confidence: number,
  rest: Pick<BenchmarkDivergence, "groundTruthRef" | "description"> & {
    readonly canonicalRefs?: readonly string[];
    readonly brainRefs?: readonly string[];
  },
): BenchmarkDivergence {
  return Object.freeze({
    type,
    severity,
    confidence,
    canonicalRefs: Object.freeze([...(rest.canonicalRefs ?? [])]),
    brainRefs: Object.freeze([...(rest.brainRefs ?? [])]),
    groundTruthRef: rest.groundTruthRef,
    humanReviewRequired:
      severity === "critical" ||
      type === "ROI_DISAGREEMENT" ||
      type === "BRAIN_FALSE_POSITIVE" ||
      type === "PRIORITY_DISAGREEMENT",
    description: rest.description,
  });
}
