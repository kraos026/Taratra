export type RoiDirection = "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "INSUFFICIENT_EVIDENCE";

export type BenchmarkArm = "CANONICAL" | "BRAIN_ONLY" | "HYBRID";

export type HybridContributionKind =
  | "CANONICAL_BASE"
  | "BRAIN_ADDITION"
  | "BRAIN_CHALLENGE"
  | "BRAIN_CONFIRMATION"
  | "NEEDS_MORE_EVIDENCE";

export type BenchmarkDimension =
  | "factualAccuracy"
  | "coverage"
  | "falsePositiveControl"
  | "prioritization"
  | "businessRelevance"
  | "feasibility"
  | "roiCredibility"
  | "evidenceProvenance"
  | "riskAwareness"
  | "explanationQuality";

export type BenchmarkDivergenceType =
  | "AGREE"
  | "BRAIN_ADDS_VALUE"
  | "CANONICAL_BETTER"
  | "BRAIN_FALSE_POSITIVE"
  | "CANONICAL_MISSED_ITEM"
  | "PRIORITY_DISAGREEMENT"
  | "ROI_DISAGREEMENT"
  | "INSUFFICIENT_EVIDENCE";

export type BenchmarkWinner =
  | "CANONICAL_WINS"
  | "BRAIN_ONLY_WINS"
  | "HYBRID_WINS"
  | "NO_MEANINGFUL_DIFFERENCE"
  | "INSUFFICIENT_EVIDENCE";

export type BenchmarkSeverity = "low" | "medium" | "high" | "critical";

export interface BenchmarkPublicInput {
  readonly caseId: string;
  readonly title: string;
  readonly companyContext: string;
  readonly process: string;
  readonly roles: readonly string[];
  readonly tools: readonly string[];
  readonly workflow: readonly string[];
  readonly volumes: Readonly<Record<string, number | string>>;
  readonly durations: Readonly<Record<string, number | string>>;
  readonly manualWork: readonly string[];
  readonly painPoints: readonly string[];
  readonly risks: readonly string[];
  readonly constraints: readonly string[];
  readonly evidence: readonly BenchmarkEvidenceInput[];
}

export interface BenchmarkEvidenceInput {
  readonly id: string;
  readonly source: string;
  readonly statement: string;
  readonly reliability: number;
}

export interface BenchmarkConcept {
  readonly id: string;
  readonly label: string;
  readonly aliases: readonly string[];
  readonly critical?: boolean;
}

export interface BenchmarkEvidenceMapping {
  readonly evidenceId: string;
  readonly supports: readonly string[];
}

export interface BenchmarkScoringMetadata {
  readonly aliases: Readonly<Record<string, readonly string[]>>;
  readonly evidenceMappings: readonly BenchmarkEvidenceMapping[];
}

export interface BenchmarkGroundTruth {
  readonly expectedFindings: readonly BenchmarkConcept[];
  readonly expectedRootCauses: readonly BenchmarkConcept[];
  readonly expectedBottlenecks: readonly BenchmarkConcept[];
  readonly expectedOpportunities: readonly BenchmarkConcept[];
  readonly forbiddenInventions: readonly BenchmarkConcept[];
  readonly expectedExclusions: readonly BenchmarkConcept[];
  readonly expectedPriorityOrder: readonly string[];
  readonly expectedRoiDirection: RoiDirection;
  readonly requiredEvidence: readonly string[];
  readonly risksToRecognize: readonly string[];
}

export interface BenchmarkCase {
  readonly publicInput: BenchmarkPublicInput;
  readonly scoringMetadata: BenchmarkScoringMetadata;
  readonly hiddenGroundTruth: BenchmarkGroundTruth;
}

export interface CanonicalBenchmarkSnapshot {
  readonly caseId: string;
  readonly knowledgeFacts: readonly BenchmarkClaimLike[];
  readonly processStructure: readonly string[];
  readonly businessFindings: readonly BenchmarkClaimLike[];
  readonly aiOpportunities: readonly BenchmarkOpportunityLike[];
  readonly automationOpportunities: readonly BenchmarkOpportunityLike[];
  readonly roi: BenchmarkRoiLike;
  readonly recommendations: readonly BenchmarkOpportunityLike[];
  readonly blueprintSummary: BenchmarkImplementationLike;
  readonly specificationSummary: BenchmarkImplementationLike;
  readonly executiveResult: BenchmarkExecutiveLike;
}

export interface BrainShadowBenchmarkSnapshot {
  readonly caseId: string;
  readonly claims: readonly BenchmarkClaimLike[];
  readonly evidenceRefs: readonly string[];
  readonly unknowns: readonly string[];
  readonly contradictions: readonly string[];
  readonly rootCauses: readonly BenchmarkClaimLike[];
  readonly bottlenecks: readonly BenchmarkClaimLike[];
  readonly opportunityDecisions: readonly BenchmarkOpportunityLike[];
  readonly priorities: readonly string[];
  readonly economicAssessment: BenchmarkRoiLike;
  readonly critiques: readonly string[];
  readonly confidence: number;
  readonly hybridContributions?: readonly HybridContribution[];
}

export interface HybridContribution {
  readonly kind: HybridContributionKind;
  readonly statement: string;
  readonly conceptIds: readonly string[];
  readonly evidenceRefs: readonly string[];
}

export interface BenchmarkClaimLike {
  readonly id: string;
  readonly statement: string;
  readonly conceptIds: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly confidence: number;
  readonly critical?: boolean;
}

export interface BenchmarkOpportunityLike {
  readonly id: string;
  readonly title: string;
  readonly conceptIds: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly priorityRank: number;
  readonly decision: "RECOMMEND" | "DEFER" | "REJECT" | "NEED_MORE_EVIDENCE";
  readonly confidence: number;
}

export interface BenchmarkRoiLike {
  readonly direction: RoiDirection;
  readonly confidence: number;
  readonly evidenceRefs: readonly string[];
  readonly numericClaims: readonly string[];
  readonly missingInputs: readonly string[];
}

export interface BenchmarkImplementationLike {
  readonly status: "READY" | "INCOMPLETE" | "NOT_APPLICABLE";
  readonly selectedPatterns: readonly string[];
  readonly controls: readonly string[];
  readonly evidenceRefs: readonly string[];
}

export interface BenchmarkExecutiveLike {
  readonly status: "READY" | "UNAVAILABLE";
  readonly complete: boolean;
  readonly priorityCards: readonly string[];
  readonly evidenceRefs: readonly string[];
}

export interface BenchmarkDimensionScore {
  readonly dimension: BenchmarkDimension;
  readonly weight: number;
  readonly rawScore: number;
  readonly weightedScore: number;
  readonly rationale: string;
}

export interface BenchmarkScore {
  readonly overall: number;
  readonly dimensions: Readonly<Record<BenchmarkDimension, BenchmarkDimensionScore>>;
  readonly falsePositiveCount: number;
  readonly criticalFalsePositiveCount: number;
  readonly unsupportedRoiClaimCount: number;
  readonly missingExpectedItems: readonly string[];
  readonly matchedExpectedItems: readonly string[];
  readonly priorityScore: number;
  readonly evidenceProvenanceScore: number;
}

export interface BenchmarkDivergence {
  readonly type: BenchmarkDivergenceType;
  readonly severity: BenchmarkSeverity;
  readonly confidence: number;
  readonly canonicalRefs: readonly string[];
  readonly brainRefs: readonly string[];
  readonly groundTruthRef: string | null;
  readonly humanReviewRequired: boolean;
  readonly description: string;
}

export interface BenchmarkCaseResult {
  readonly caseId: string;
  readonly canonicalSnapshot: CanonicalBenchmarkSnapshot;
  readonly brainOnlySnapshot: BrainShadowBenchmarkSnapshot;
  readonly hybridSnapshot: BrainShadowBenchmarkSnapshot;
  readonly canonicalScore: BenchmarkScore;
  readonly brainOnlyScore: BenchmarkScore;
  readonly hybridScore: BenchmarkScore;
  readonly brainOnlyDelta: number;
  readonly hybridDelta: number;
  readonly brainOnlyIncrementalValue: boolean;
  readonly hybridIncrementalValue: boolean;
  readonly winner: BenchmarkWinner;
  readonly brainOnlyDivergences: readonly BenchmarkDivergence[];
  readonly hybridDivergences: readonly BenchmarkDivergence[];
}

export interface BenchmarkRunResult {
  readonly codeSha: string;
  readonly benchmarkVersion: string;
  readonly caseCount: number;
  readonly canonicalAverageScore: number;
  readonly brainOnlyAverageScore: number;
  readonly hybridAverageScore: number;
  readonly brainOnlyUsefulAdditionRate: number;
  readonly hybridUsefulAdditionRate: number;
  readonly brainOnlyFalsePositiveRate: number;
  readonly hybridFalsePositiveRate: number;
  readonly brainOnlyCriticalHallucinations: number;
  readonly hybridCriticalHallucinations: number;
  readonly brainOnlyUnsupportedRoiClaims: number;
  readonly hybridUnsupportedRoiClaims: number;
  readonly brainOnlyDivergenceCounts: Readonly<Record<BenchmarkDivergenceType, number>>;
  readonly hybridDivergenceCounts: Readonly<Record<BenchmarkDivergenceType, number>>;
  readonly perCase: readonly BenchmarkCaseResult[];
  readonly promotionEligible: false;
  readonly promotionRationale: string;
}
