import {
  Claim,
  Contradiction,
  Decision,
  type ClaimKind,
  type ContradictionKind,
  type ContradictionMateriality,
  type DecisionType,
  type Evidence,
  type UnknownInformation,
} from "./brain-contracts";

export type ImpactTarget = "finding" | "opportunity" | "roi" | "decision" | "recommendation";
export type RequiredEvidenceType =
  "METRIC" | "INTERVIEW" | "DOCUMENT" | "OBSERVATION" | "SYSTEM_RECORD";

export interface EvidenceAgreement {
  readonly subject: string;
  readonly agreementScore: number;
  readonly disagreementScore: number;
  readonly weightedAgreementScore: number;
  readonly strongAgreementCount: number;
  readonly weakOutlierCount: number;
  readonly rationale: string;
}

export interface UncertaintyAssessmentResult {
  readonly claimId: string;
  readonly uncertaintyScore: number;
  readonly confidenceAdjustment: number;
  readonly factors: {
    readonly evidenceCount: number;
    readonly averageReliability: number;
    readonly averageFreshness: number;
    readonly agreement: number;
    readonly contradictionBurden: number;
    readonly missingInformationBurden: number;
    readonly claimTypeBurden: number;
    readonly inferenceDepthBurden: number;
  };
  readonly rationale: string;
}

export interface MaterialityResult {
  readonly contradictionId: string;
  readonly target: ImpactTarget;
  readonly material: boolean;
  readonly materiality: ContradictionMateriality;
  readonly score: number;
  readonly rationale: string;
}

export interface ClarificationRequirement {
  readonly clarificationId: string;
  readonly targetSubject: string;
  readonly reason: string;
  readonly affectedDecisions: readonly ImpactTarget[];
  readonly priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  readonly requiredEvidenceType: RequiredEvidenceType;
  readonly suggestedQuestionOrAction: string;
}

export interface DecisionGuardResult {
  readonly decisionType: DecisionType;
  readonly blocked: boolean;
  readonly rationale: string;
  readonly clarificationRequirements: readonly ClarificationRequirement[];
}

export interface ContradictionDetectionInput {
  readonly subject: string;
  readonly claims: readonly Claim[];
  readonly evidence: readonly Evidence[];
  readonly assumptions?: readonly Evidence[];
  readonly detectedAt: Date;
}

export class EvidenceAgreementModel {
  assess(subject: string, evidence: readonly Evidence[]): EvidenceAgreement {
    const values = evidence
      .map((item) => ({ evidence: item, value: comparableValue(item.structuredValue) }))
      .filter(
        (item): item is { evidence: Evidence; value: string | number | boolean } =>
          item.value !== null,
      );
    if (values.length <= 1) {
      return freezeAgreement({
        subject,
        agreementScore: values.length === 1 ? 1 : 0,
        disagreementScore: 0,
        weightedAgreementScore: values.length === 1 ? freshnessWeight(values[0]!.evidence) : 0,
        strongAgreementCount: values.length,
        weakOutlierCount: 0,
        rationale: "Insufficient comparable evidence for disagreement",
      });
    }

    const pairCount = (values.length * (values.length - 1)) / 2;
    let agreeingPairs = 0;
    let weightedAgreement = 0;
    let totalWeight = 0;
    const groups = values.map((item) => ({
      count: values.filter((candidate) => sameComparableValue(item.value, candidate.value)).length,
      weight: values
        .filter((candidate) => sameComparableValue(item.value, candidate.value))
        .reduce((sum, candidate) => sum + reliabilityFreshnessWeight(candidate.evidence), 0),
    }));

    for (let leftIndex = 0; leftIndex < values.length; leftIndex += 1) {
      const left = values[leftIndex]!;
      for (let rightIndex = leftIndex + 1; rightIndex < values.length; rightIndex += 1) {
        const right = values[rightIndex]!;
        const pairWeight =
          (reliabilityFreshnessWeight(left.evidence) + reliabilityFreshnessWeight(right.evidence)) /
          2;
        totalWeight += pairWeight;
        if (sameComparableValue(left.value, right.value)) {
          agreeingPairs += 1;
          weightedAgreement += pairWeight;
        }
      }
    }

    const strongest = groups.sort((a, b) => b.weight - a.weight || b.count - a.count)[0]!;
    const weakOutlierCount = values.filter((item) => {
      const itemWeight = reliabilityFreshnessWeight(item.evidence);
      const agreesWithStrongCluster =
        values.filter((candidate) => sameComparableValue(item.value, candidate.value)).length ===
        strongest.count;
      return !agreesWithStrongCluster && itemWeight < strongest.weight * 0.35;
    }).length;

    const agreementScore = round(agreeingPairs / pairCount);
    const weightedAgreementScore = totalWeight === 0 ? 0 : round(weightedAgreement / totalWeight);
    return freezeAgreement({
      subject,
      agreementScore,
      disagreementScore: round(1 - agreementScore),
      weightedAgreementScore,
      strongAgreementCount: strongest.count,
      weakOutlierCount,
      rationale: "Agreement preserves all sources and does not choose a canonical winner",
    });
  }
}

export class ContradictionDetector {
  detect(input: ContradictionDetectionInput): readonly Contradiction[] {
    const contradictions: Contradiction[] = [];
    for (let leftIndex = 0; leftIndex < input.claims.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < input.claims.length; rightIndex += 1) {
        const left = input.claims[leftIndex]!;
        const right = input.claims[rightIndex]!;
        const kind = contradictionKind(left, right, input.evidence);
        if (!kind) continue;
        contradictions.push(
          Contradiction.create({
            contradictionId: `contradiction:${input.subject.replace(/[^a-zA-Z0-9_-]+/g, "-")}:${contradictions.length + 1}`,
            kind,
            leftClaimId: left.claimId,
            rightClaimId: right.claimId,
            leftEvidenceIds: left.supportingEvidenceIds,
            rightEvidenceIds: right.supportingEvidenceIds,
            materiality: kind === "STALE_VS_CURRENT" ? "MEDIUM" : "HIGH",
            impact: `${kind.toLowerCase()} contradiction affects ${input.subject}`,
            requiresClarification: kind !== "STALE_VS_CURRENT",
            detectedAt: input.detectedAt,
          }),
        );
      }
    }

    for (const assumption of input.assumptions ?? []) {
      for (const evidence of input.evidence) {
        const assumptionValue = comparableValue(assumption.structuredValue);
        const evidenceValue = comparableValue(evidence.structuredValue);
        if (assumptionValue === null || evidenceValue === null) continue;
        if (!sameComparableValue(assumptionValue, evidenceValue)) {
          const firstClaim = input.claims[0];
          const secondClaim = input.claims[1] ?? input.claims[0];
          if (!firstClaim || !secondClaim) continue;
          contradictions.push(
            Contradiction.create({
              contradictionId: `contradiction:${input.subject.replace(/[^a-zA-Z0-9_-]+/g, "-")}:assumption:${contradictions.length + 1}`,
              kind: "EVIDENCE_VS_ASSUMPTION",
              leftClaimId: firstClaim.claimId,
              rightClaimId: secondClaim.claimId,
              leftEvidenceIds: [assumption.evidenceId],
              rightEvidenceIds: [evidence.evidenceId],
              materiality: "HIGH",
              impact: `Assumption conflicts with observed evidence for ${input.subject}`,
              requiresClarification: true,
              detectedAt: input.detectedAt,
            }),
          );
        }
      }
    }

    return Object.freeze(contradictions);
  }
}

export class UncertaintyAssessment {
  assess(input: {
    readonly claim: Claim;
    readonly evidence: readonly Evidence[];
    readonly agreement: EvidenceAgreement;
    readonly contradictions: readonly Contradiction[];
    readonly unknowns: readonly UnknownInformation[];
    readonly inferenceDepth: number;
  }): UncertaintyAssessmentResult {
    const evidenceCount = input.evidence.length;
    const averageReliability = average(input.evidence.map((item) => item.reliability));
    const averageFreshness = average(input.evidence.map(freshnessWeight));
    const contradictionBurden = Math.min(
      1,
      input.contradictions.reduce((sum, item) => sum + materialityWeight(item.materiality), 0),
    );
    const missingInformationBurden = Math.min(1, input.unknowns.length * 0.25);
    const claimTypeBurden = claimKindBurden(input.claim.kind);
    const inferenceDepthBurden = Math.min(1, Math.max(0, input.inferenceDepth) * 0.15);
    const evidenceScarcity = evidenceCount === 0 ? 1 : evidenceCount === 1 ? 0.35 : 0;
    const uncertaintyScore = round(
      Math.min(
        1,
        evidenceScarcity * 0.15 +
          (1 - averageReliability) * 0.15 +
          (1 - averageFreshness) * 0.15 +
          input.agreement.disagreementScore * 0.2 +
          contradictionBurden * 0.2 +
          missingInformationBurden * 0.1 +
          claimTypeBurden * 0.03 +
          inferenceDepthBurden * 0.02,
      ),
    );
    return Object.freeze({
      claimId: input.claim.claimId,
      uncertaintyScore,
      confidenceAdjustment: round(1 - uncertaintyScore),
      factors: Object.freeze({
        evidenceCount,
        averageReliability,
        averageFreshness,
        agreement: input.agreement.weightedAgreementScore,
        contradictionBurden,
        missingInformationBurden,
        claimTypeBurden,
        inferenceDepthBurden,
      }),
      rationale:
        "Uncertainty is deterministic and derived from evidence quality, agreement, contradictions and unknowns",
    });
  }
}

export class MaterialityEngine {
  assess(contradiction: Contradiction, target: ImpactTarget): MaterialityResult {
    const base = materialityWeight(contradiction.materiality);
    const targetWeight = targetImpactWeight(target);
    const score = round(Math.min(1, base * targetWeight));
    const material = score >= 0.5 || (target === "roi" && contradiction.kind === "QUANTITATIVE");
    return Object.freeze({
      contradictionId: contradiction.contradictionId,
      target,
      material,
      materiality: contradiction.materiality,
      score,
      rationale: material
        ? `${contradiction.kind} contradiction materially affects ${target}`
        : `${contradiction.kind} contradiction is not material for ${target}`,
    });
  }
}

export class ClarificationRequirementGenerator {
  generate(input: {
    readonly subject: string;
    readonly contradictions: readonly Contradiction[];
    readonly target: ImpactTarget;
    readonly materiality: readonly MaterialityResult[];
  }): readonly ClarificationRequirement[] {
    return Object.freeze(
      input.contradictions
        .filter((contradiction) =>
          input.materiality.some(
            (result) => result.contradictionId === contradiction.contradictionId && result.material,
          ),
        )
        .map((contradiction) =>
          Object.freeze({
            clarificationId: `clarification:${contradiction.contradictionId}`,
            targetSubject: input.subject,
            reason: contradiction.impact,
            affectedDecisions: Object.freeze([input.target]),
            priority: contradiction.materiality,
            requiredEvidenceType:
              contradiction.kind === "QUANTITATIVE"
                ? "METRIC"
                : ("INTERVIEW" as RequiredEvidenceType),
            suggestedQuestionOrAction:
              contradiction.kind === "QUANTITATIVE"
                ? `Provide recent measured data for ${input.subject}.`
                : `Clarify conflicting reports for ${input.subject}.`,
          }),
        ),
    );
  }
}

export class BrainDecisionGuard {
  evaluate(input: {
    readonly decision: Decision;
    readonly materiality: readonly MaterialityResult[];
    readonly clarifications: readonly ClarificationRequirement[];
  }): DecisionGuardResult {
    const unresolvedMaterial = input.materiality.some((item) => item.material);
    if (unresolvedMaterial) {
      return Object.freeze({
        decisionType: "NEED_MORE_EVIDENCE",
        blocked: true,
        rationale: "Unresolved material contradiction blocks the requested decision",
        clarificationRequirements: Object.freeze([...input.clarifications]),
      });
    }
    return Object.freeze({
      decisionType: input.decision.decisionType,
      blocked: false,
      rationale: "No material unresolved contradiction blocks the decision",
      clarificationRequirements: Object.freeze([]),
    });
  }
}

function contradictionKind(
  left: Claim,
  right: Claim,
  evidence: readonly Evidence[],
): ContradictionKind | null {
  const leftValues = evidenceForClaim(left, evidence).map((item) =>
    comparableValue(item.structuredValue),
  );
  const rightValues = evidenceForClaim(right, evidence).map((item) =>
    comparableValue(item.structuredValue),
  );
  if (!leftValues.length || !rightValues.length) return null;
  const leftValue = leftValues[0];
  const rightValue = rightValues[0];
  if (leftValue === null || rightValue === null) return null;
  if (sameComparableValue(leftValue, rightValue)) {
    const staleLeft = evidenceForClaim(left, evidence).some((item) => item.freshness === "STALE");
    const staleRight = evidenceForClaim(right, evidence).some((item) => item.freshness === "STALE");
    return staleLeft !== staleRight ? "STALE_VS_CURRENT" : null;
  }
  if (typeof leftValue === "number" && typeof rightValue === "number") return "QUANTITATIVE";
  if (sourceReferencesDiffer(left, right, evidence)) return "ACTOR_REPORT";
  return "QUALITATIVE";
}

function evidenceForClaim(claim: Claim, evidence: readonly Evidence[]): readonly Evidence[] {
  const ids = new Set(claim.supportingEvidenceIds);
  return evidence.filter((item) => ids.has(item.evidenceId));
}

function sourceReferencesDiffer(left: Claim, right: Claim, evidence: readonly Evidence[]): boolean {
  const leftSource = evidenceForClaim(left, evidence)[0]?.sourceReference;
  const rightSource = evidenceForClaim(right, evidence)[0]?.sourceReference;
  return Boolean(leftSource && rightSource && leftSource !== rightSource);
}

function comparableValue(value: unknown): string | number | boolean | null {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  for (const key of keys) {
    const nested = record[key];
    if (typeof nested === "string" || typeof nested === "number" || typeof nested === "boolean")
      return nested;
    if (
      Array.isArray(nested) &&
      nested.length === 2 &&
      typeof nested[0] === "number" &&
      typeof nested[1] === "number"
    )
      return round((nested[0] + nested[1]) / 2);
  }
  return null;
}

function sameComparableValue(left: string | number | boolean, right: string | number | boolean) {
  if (typeof left === "number" && typeof right === "number") {
    const tolerance = Math.max(1, Math.abs(left) * 0.1, Math.abs(right) * 0.1);
    return Math.abs(left - right) <= tolerance;
  }
  return left === right;
}

function freshnessWeight(evidence: Evidence): number {
  switch (evidence.freshness) {
    case "CURRENT":
      return 1;
    case "RECENT":
      return 0.75;
    case "STALE":
      return 0.35;
    case "UNKNOWN":
      return 0.5;
  }
}

function reliabilityFreshnessWeight(evidence: Evidence): number {
  return round(evidence.reliability * freshnessWeight(evidence));
}

function materialityWeight(materiality: ContradictionMateriality): number {
  switch (materiality) {
    case "LOW":
      return 0.2;
    case "MEDIUM":
      return 0.45;
    case "HIGH":
      return 0.75;
    case "CRITICAL":
      return 1;
  }
}

function targetImpactWeight(target: ImpactTarget): number {
  switch (target) {
    case "finding":
      return 0.55;
    case "opportunity":
      return 0.7;
    case "roi":
      return 0.95;
    case "decision":
      return 0.85;
    case "recommendation":
      return 0.9;
  }
}

function claimKindBurden(kind: ClaimKind): number {
  switch (kind) {
    case "FACT":
      return 0;
    case "INFERENCE":
      return 0.25;
    case "HYPOTHESIS":
      return 0.45;
    case "UNKNOWN":
      return 1;
  }
}

function average(values: readonly number[]): number {
  if (!values.length) return 0;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function freezeAgreement(input: EvidenceAgreement): EvidenceAgreement {
  return Object.freeze(input);
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
