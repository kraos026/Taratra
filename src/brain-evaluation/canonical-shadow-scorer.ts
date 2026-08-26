import type {
  BenchmarkCase,
  BenchmarkConcept,
  BenchmarkDimension,
  BenchmarkDimensionScore,
  BenchmarkRoiLike,
  BenchmarkScore,
  BrainShadowBenchmarkSnapshot,
  CanonicalBenchmarkSnapshot,
} from "./canonical-shadow-types";

export const benchmarkWeights: Readonly<Record<BenchmarkDimension, number>> = Object.freeze({
  factualAccuracy: 20,
  coverage: 15,
  falsePositiveControl: 12,
  prioritization: 12,
  businessRelevance: 10,
  feasibility: 10,
  roiCredibility: 10,
  evidenceProvenance: 6,
  riskAwareness: 3,
  explanationQuality: 2,
});

export function assertBenchmarkWeightsTotal100(): void {
  const total = Object.values(benchmarkWeights).reduce((sum, weight) => sum + weight, 0);
  if (total !== 100) throw new Error(`Benchmark weights must total 100, got ${total}`);
}

export function scoreCanonicalSnapshot(
  benchmarkCase: BenchmarkCase,
  snapshot: CanonicalBenchmarkSnapshot,
): BenchmarkScore {
  return scoreBenchmarkSubject(benchmarkCase, {
    findings: snapshot.businessFindings,
    rootCauses: [],
    bottlenecks: [],
    opportunities: snapshot.recommendations,
    priorities: snapshot.recommendations.map((item) => item.conceptIds[0] ?? item.id),
    roi: snapshot.roi,
    implementationEvidence: [
      ...snapshot.blueprintSummary.evidenceRefs,
      ...snapshot.specificationSummary.evidenceRefs,
      ...snapshot.executiveResult.evidenceRefs,
    ],
    risks: [
      ...snapshot.businessFindings.map((item) => item.statement),
      ...snapshot.blueprintSummary.controls,
    ],
  });
}

export function scoreBrainSnapshot(
  benchmarkCase: BenchmarkCase,
  snapshot: BrainShadowBenchmarkSnapshot,
): BenchmarkScore {
  return scoreBenchmarkSubject(benchmarkCase, {
    findings: snapshot.claims,
    rootCauses: snapshot.rootCauses,
    bottlenecks: snapshot.bottlenecks,
    opportunities: snapshot.opportunityDecisions,
    priorities: snapshot.priorities,
    roi: snapshot.economicAssessment,
    implementationEvidence: snapshot.evidenceRefs,
    risks: [...snapshot.critiques, ...snapshot.claims.map((item) => item.statement)],
  });
}

function scoreBenchmarkSubject(
  benchmarkCase: BenchmarkCase,
  subject: {
    readonly findings: readonly {
      conceptIds: readonly string[];
      evidenceRefs: readonly string[];
      statement: string;
      critical?: boolean;
    }[];
    readonly rootCauses: readonly {
      conceptIds: readonly string[];
      evidenceRefs: readonly string[];
      statement: string;
    }[];
    readonly bottlenecks: readonly {
      conceptIds: readonly string[];
      evidenceRefs: readonly string[];
      statement: string;
    }[];
    readonly opportunities: readonly {
      conceptIds: readonly string[];
      evidenceRefs: readonly string[];
      title: string;
      decision: string;
    }[];
    readonly priorities: readonly string[];
    readonly roi: BenchmarkRoiLike;
    readonly implementationEvidence: readonly string[];
    readonly risks: readonly string[];
  },
): BenchmarkScore {
  const truth = benchmarkCase.hiddenGroundTruth;
  const observedConceptIds = new Set([
    ...subject.findings.flatMap((item) => item.conceptIds),
    ...subject.rootCauses.flatMap((item) => item.conceptIds),
    ...subject.bottlenecks.flatMap((item) => item.conceptIds),
    ...subject.opportunities.flatMap((item) => item.conceptIds),
  ]);
  const observedText = [
    ...subject.findings.map((item) => item.statement),
    ...subject.rootCauses.map((item) => item.statement),
    ...subject.bottlenecks.map((item) => item.statement),
    ...subject.opportunities.map((item) => item.title),
    ...subject.risks,
    ...subject.roi.numericClaims,
  ].join(" ");

  const expected = [
    ...truth.expectedFindings,
    ...truth.expectedRootCauses,
    ...truth.expectedBottlenecks,
    ...truth.expectedOpportunities,
  ];
  const matched = expected.filter((concept) =>
    conceptMatches(
      concept,
      observedConceptIds,
      observedText,
      benchmarkCase.scoringMetadata.aliases,
    ),
  );
  const missing = expected.filter((concept) => !matched.includes(concept));
  const forbidden = truth.forbiddenInventions.filter((concept) =>
    conceptMatches(
      concept,
      observedConceptIds,
      observedText,
      benchmarkCase.scoringMetadata.aliases,
    ),
  );
  const criticalFalsePositiveCount = forbidden.filter((concept) => concept.critical).length;
  const falsePositiveCount = forbidden.length;
  const unsupportedRoiClaimCount = unsupportedRoiClaims(truth.expectedRoiDirection, subject.roi);
  const priorityScore = rankScore(truth.expectedPriorityOrder, subject.priorities);
  const evidenceProvenanceScore = evidenceScore(truth.requiredEvidence, [
    ...subject.findings.flatMap((item) => item.evidenceRefs),
    ...subject.rootCauses.flatMap((item) => item.evidenceRefs),
    ...subject.bottlenecks.flatMap((item) => item.evidenceRefs),
    ...subject.opportunities.flatMap((item) => item.evidenceRefs),
    ...subject.implementationEvidence,
    ...subject.roi.evidenceRefs,
  ]);
  const riskScore = ratio(
    truth.risksToRecognize.filter((risk) =>
      conceptMatches(
        { id: risk, label: risk, aliases: [] },
        new Set(),
        subject.risks.join(" "),
        benchmarkCase.scoringMetadata.aliases,
      ),
    ).length,
    truth.risksToRecognize.length,
  );
  const expectedExclusionScore = truth.expectedExclusions.every(
    (exclusion) =>
      !conceptMatches(
        exclusion,
        observedConceptIds,
        observedText,
        benchmarkCase.scoringMetadata.aliases,
      ),
  )
    ? 1
    : 0;
  const coverage = ratio(matched.length, expected.length);
  const factual = clamp01(coverage - falsePositiveCount * 0.2 - unsupportedRoiClaimCount * 0.25);
  const roiCredibility =
    subject.roi.direction === truth.expectedRoiDirection
      ? subject.roi.evidenceRefs.length > 0 ||
        truth.expectedRoiDirection === "INSUFFICIENT_EVIDENCE"
        ? 1
        : 0.5
      : 0;
  const falsePositiveControl = clamp01(
    1 - falsePositiveCount * 0.35 - unsupportedRoiClaimCount * 0.35,
  );
  const businessRelevance = clamp01((coverage + expectedExclusionScore + riskScore) / 3);
  const feasibility = clamp01((expectedExclusionScore + falsePositiveControl) / 2);
  const explanationQuality = clamp01((evidenceProvenanceScore + coverage) / 2);

  const dimensionValues: Record<BenchmarkDimension, [number, string]> = {
    factualAccuracy: [factual, "Expected concepts matched without unsupported claims"],
    coverage: [coverage, "Expected findings, root causes, bottlenecks and opportunities covered"],
    falsePositiveControl: [
      falsePositiveControl,
      "Forbidden inventions and unsupported ROI avoided",
    ],
    prioritization: [priorityScore, "Priority order compared with ground truth"],
    businessRelevance: [businessRelevance, "Relevant expected items and constraints represented"],
    feasibility: [feasibility, "Required exclusions and feasibility constraints respected"],
    roiCredibility: [roiCredibility, "ROI direction and evidence support checked"],
    evidenceProvenance: [evidenceProvenanceScore, "Required evidence references preserved"],
    riskAwareness: [riskScore, "Material risks recognized"],
    explanationQuality: [explanationQuality, "Deterministic proxy from coverage and provenance"],
  };
  const dimensions = Object.fromEntries(
    Object.entries(benchmarkWeights).map(([dimension, weight]) => {
      const key = dimension as BenchmarkDimension;
      const [rawScore, rationale] = dimensionValues[key];
      return [key, dimensionScore(key, weight, rawScore, rationale)];
    }),
  ) as Readonly<Record<BenchmarkDimension, BenchmarkDimensionScore>>;
  const overall = round(
    Object.values(dimensions).reduce((sum, dimension) => sum + dimension.weightedScore, 0),
  );
  return Object.freeze({
    overall,
    dimensions,
    falsePositiveCount,
    criticalFalsePositiveCount,
    unsupportedRoiClaimCount,
    missingExpectedItems: Object.freeze(missing.map((item) => item.id)),
    matchedExpectedItems: Object.freeze(matched.map((item) => item.id)),
    priorityScore,
    evidenceProvenanceScore,
  });
}

function dimensionScore(
  dimension: BenchmarkDimension,
  weight: number,
  rawScore: number,
  rationale: string,
): BenchmarkDimensionScore {
  return Object.freeze({
    dimension,
    weight,
    rawScore: round(clamp01(rawScore)),
    weightedScore: round(clamp01(rawScore) * weight),
    rationale,
  });
}

function conceptMatches(
  concept: BenchmarkConcept,
  observedConceptIds: ReadonlySet<string>,
  observedText: string,
  aliases: Readonly<Record<string, readonly string[]>>,
): boolean {
  if (observedConceptIds.has(concept.id)) return true;
  const accepted = [concept.id, concept.label, ...concept.aliases, ...(aliases[concept.id] ?? [])];
  return accepted.some((alias) => normalizedIncludes(observedText, alias));
}

function normalizedIncludes(text: string, candidate: string): boolean {
  return normalize(text).includes(normalize(candidate));
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unsupportedRoiClaims(
  expected: BenchmarkRoiLike["direction"],
  roi: BenchmarkRoiLike,
): number {
  if (expected === "INSUFFICIENT_EVIDENCE" && roi.numericClaims.length > 0)
    return roi.numericClaims.length;
  if (roi.direction !== expected && roi.confidence > 0.7) return 1;
  return 0;
}

function rankScore(expected: readonly string[], actual: readonly string[]): number {
  if (expected.length === 0) return 1;
  const actualRanks = new Map(actual.map((id, index) => [id, index]));
  let total = 0;
  for (let i = 0; i < expected.length; i += 1) {
    const rank = actualRanks.get(expected[i]);
    if (rank === undefined) continue;
    total += Math.max(0, 1 - Math.abs(rank - i) / Math.max(1, expected.length - 1));
  }
  return clamp01(total / expected.length);
}

function evidenceScore(required: readonly string[], actual: readonly string[]): number {
  if (required.length === 0) return 1;
  const actualSet = new Set(actual);
  return ratio(required.filter((id) => actualSet.has(id)).length, required.length);
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : clamp01(numerator / denominator);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
