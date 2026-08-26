import { describe, expect, it } from "vitest";

import {
  createBrainOnlyShadowSnapshot,
  createCanonicalBenchmarkSnapshot,
  runCanonicalShadowBenchmark,
} from "./canonical-shadow-benchmark";
import { canonicalShadowCases } from "./canonical-shadow-scenarios";
import { classifyBenchmarkDivergences } from "./canonical-shadow-divergence";
import { benchmarkWeights, scoreBrainSnapshot } from "./canonical-shadow-scorer";
import type {
  BenchmarkOpportunityLike,
  BenchmarkPublicInput,
  BrainShadowBenchmarkSnapshot,
} from "./canonical-shadow-types";

describe("Canonical shadow V3 fixture design validation", () => {
  it("defines exactly 25 unique benchmark cases while preserving the baseline IDs", () => {
    const ids = canonicalShadowCases.map((item) => item.publicInput.caseId);

    expect(ids).toHaveLength(25);
    expect(new Set(ids).size).toBe(25);
    expect(ids.slice(0, 5)).toEqual([
      "manual_invoice_processing",
      "customer_support_overload",
      "employee_onboarding_hr_admin",
      "sales_lead_qualification",
      "inventory_purchasing_workflow",
    ]);
  });

  it("has unique case IDs", () => {
    const ids = canonicalShadowCases.map((item) => item.publicInput.caseId);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps hidden truth and scorer-only ontology out of public input", () => {
    for (const benchmarkCase of canonicalShadowCases) {
      const publicWithoutRunId = { ...benchmarkCase.publicInput, caseId: "case-id-is-not-content" };
      const publicJson = JSON.stringify(publicWithoutRunId);
      const hiddenJson = JSON.stringify(benchmarkCase.hiddenGroundTruth);
      const scorerJson = JSON.stringify(benchmarkCase.scoringMetadata);

      expect(publicJson).not.toContain("hiddenGroundTruth");
      expect(publicJson).not.toContain("scoringMetadata");
      expect(publicJson).not.toContain("expectedFindings");
      expect(publicJson).not.toContain("forbiddenInventions");
      expect(publicJson).not.toContain("aliases");
      expect(publicJson).not.toContain("supports");
      for (const conceptId of conceptIds(hiddenJson)) expect(publicJson).not.toContain(conceptId);
      expect(scorerJson).toContain("aliases");
      expect(scorerJson).toContain("supports");
    }
  });

  it("keeps the outcome distribution roughly balanced", () => {
    expect(distribution("expectedOutcome")).toEqual({
      AUTOMATE_NOW: 8,
      AUTOMATE_AFTER_REMEDIATION: 5,
      NEEDS_MORE_EVIDENCE: 6,
      DEFER: 3,
      DO_NOT_AUTOMATE: 3,
    });
  });

  it("covers adversarial, uncertainty, ROI, human-review and multi-opportunity requirements", () => {
    expect(countFlag("adversarial")).toBeGreaterThanOrEqual(10);
    expect(countFlag("uncertaintyRequired")).toBeGreaterThanOrEqual(8);
    expect(countFlag("roiIndeterminate")).toBeGreaterThanOrEqual(8);
    expect(countFlag("humanReviewRequired")).toBeGreaterThanOrEqual(6);
    expect(countFlag("multiOpportunity")).toBeGreaterThanOrEqual(8);
  });

  it("defines the required V3 hidden ground-truth fields for every case", () => {
    for (const benchmarkCase of canonicalShadowCases) {
      expect(benchmarkCase.hiddenGroundTruth).toHaveProperty("expectedDeferrals");
      expect(benchmarkCase.hiddenGroundTruth).toHaveProperty("expectedRejections");
      expect(benchmarkCase.hiddenGroundTruth).toHaveProperty("expectedProcessRemediation");
      expect(benchmarkCase.hiddenGroundTruth).toHaveProperty("expectedEvidenceRequests");
      expect(benchmarkCase.hiddenGroundTruth).toHaveProperty("expectedRisks");
      expect(benchmarkCase.hiddenGroundTruth).toHaveProperty("expectedHumanReview");
      expect(benchmarkCase.hiddenGroundTruth).toHaveProperty("criticalFailureConditions");
      expect(benchmarkCase.scoringMetadata.expectedOutcome).toMatch(
        /AUTOMATE_NOW|AUTOMATE_AFTER_REMEDIATION|NEEDS_MORE_EVIDENCE|DEFER|DO_NOT_AUTOMATE/,
      );
    }
  });
});

describe("Canonical vs Brain Shadow Benchmark fairness V2", () => {
  it("defines exactly 25 unique benchmark cases", () => {
    const ids = canonicalShadowCases.map((item) => item.publicInput.caseId);

    expect(ids).toHaveLength(25);
    expect(new Set(ids).size).toBe(25);
  });

  it("keeps hidden truth and scorer metadata separated from public benchmark inputs", () => {
    for (const benchmarkCase of canonicalShadowCases) {
      const publicWithoutRunId = { ...benchmarkCase.publicInput, caseId: "case-id-is-not-content" };
      const publicJson = JSON.stringify(publicWithoutRunId);
      const hiddenJson = JSON.stringify(benchmarkCase.hiddenGroundTruth);
      const scorerJson = JSON.stringify(benchmarkCase.scoringMetadata);

      expect(publicJson).not.toContain("hiddenGroundTruth");
      expect(publicJson).not.toContain("expectedFindings");
      expect(publicJson).not.toContain("forbiddenInventions");
      expect(publicJson).not.toContain("aliases");
      expect(publicJson).not.toContain("supports");
      for (const conceptId of conceptIds(hiddenJson)) expect(publicJson).not.toContain(conceptId);
      expect(scorerJson).toContain("aliases");
      expect(scorerJson).toContain("supports");
    }
  });

  it("does not pass hidden truth or scorer metadata to Brain-only runners", () => {
    let received: BenchmarkPublicInput | null = null;
    runCanonicalShadowBenchmark({
      caseIds: ["manual_invoice_processing"],
      codeSha: "fixed-sha",
      brainOnlyRunner: (publicInput) => {
        received = publicInput;
        return createBrainOnlyShadowSnapshot(publicInput);
      },
    });

    const receivedJson = JSON.stringify(received);
    expect(receivedJson).toContain("Supplier invoice");
    expect(receivedJson).not.toContain("hiddenGroundTruth");
    expect(receivedJson).not.toContain("scoringMetadata");
    expect(receivedJson).not.toContain("expectedRootCauses");
    expect(receivedJson).not.toContain("aliases");
  });

  it("does not pass canonical artifacts into the Brain-only arm", () => {
    let brainOnlyArgumentCount = 0;
    runCanonicalShadowBenchmark({
      caseIds: ["customer_support_overload"],
      codeSha: "fixed-sha",
      brainOnlyRunner: (...args) => {
        brainOnlyArgumentCount = args.length;
        return createBrainOnlyShadowSnapshot(args[0]);
      },
    });

    expect(brainOnlyArgumentCount).toBe(1);
  });

  it("passes a frozen canonical snapshot only to the Hybrid arm", () => {
    let canonicalFrozen = false;
    runCanonicalShadowBenchmark({
      caseIds: ["customer_support_overload"],
      codeSha: "fixed-sha",
      hybridRunner: (publicInput, canonicalSnapshot) => {
        canonicalFrozen = Object.isFrozen(canonicalSnapshot);
        return createBrainOnlyShadowSnapshot(publicInput);
      },
    });

    expect(canonicalFrozen).toBe(true);
  });

  it("uses bounded 0-100 scores and weights totaling 100 across all three arms", () => {
    const result = runCanonicalShadowBenchmark({ codeSha: "fixed-sha" });
    const totalWeight = Object.values(benchmarkWeights).reduce((sum, weight) => sum + weight, 0);

    expect(totalWeight).toBe(100);
    for (const caseResult of result.perCase) {
      for (const score of [
        caseResult.canonicalScore,
        caseResult.brainOnlyScore,
        caseResult.hybridScore,
      ]) {
        expect(score.overall).toBeGreaterThanOrEqual(0);
        expect(score.overall).toBeLessThanOrEqual(100);
      }
    }
  });

  it("keeps Brain-only and Hybrid as distinct first-class results", () => {
    const result = runCanonicalShadowBenchmark({ codeSha: "fixed-sha" });

    for (const caseResult of result.perCase) {
      expect(caseResult).toHaveProperty("canonicalSnapshot");
      expect(caseResult).toHaveProperty("brainOnlySnapshot");
      expect(caseResult).toHaveProperty("hybridSnapshot");
      expect(caseResult).toHaveProperty("brainOnlyScore");
      expect(caseResult).toHaveProperty("hybridScore");
      expect(caseResult.hybridSnapshot.hybridContributions?.length).toBeGreaterThan(0);
    }
  });

  it("does not let caseId changes materially alter Brain reasoning", () => {
    const original = canonicalShadowCases[0]!.publicInput;
    const mutated = { ...original, caseId: "renamed_case_for_leak_test" };
    const baseline = stripRunIds(createBrainOnlyShadowSnapshot(original));
    const changed = stripRunIds(createBrainOnlyShadowSnapshot(mutated));

    expect(changed).toEqual(baseline);
  });

  it("penalizes false positives and detects forbidden inventions", () => {
    const benchmarkCase = canonicalShadowCases[0]!;
    const clean = createBrainOnlyShadowSnapshot(benchmarkCase.publicInput);
    const polluted = withBrainOpportunity(clean, {
      id: "mutation:forbidden",
      title: "Fully autonomous payment release",
      conceptIds: ["fully_autonomous_payment_release"],
      evidenceRefs: [],
      priorityRank: 1,
      decision: "RECOMMEND",
      confidence: 0.92,
    });

    const cleanScore = scoreBrainSnapshot(benchmarkCase, clean);
    const pollutedScore = scoreBrainSnapshot(benchmarkCase, polluted);
    const divergences = classifyBenchmarkDivergences({
      benchmarkCase,
      canonical: createCanonicalBenchmarkSnapshot(benchmarkCase.publicInput),
      brain: polluted,
      canonicalScore: scoreBrainSnapshot(benchmarkCase, mirrorAsBrain(benchmarkCase.publicInput)),
      brainScore: pollutedScore,
    });

    expect(pollutedScore.overall).toBeLessThan(cleanScore.overall);
    expect(pollutedScore.falsePositiveCount).toBeGreaterThan(0);
    expect(pollutedScore.criticalFalsePositiveCount).toBeGreaterThan(0);
    expect(
      divergences.find((item) => item.type === "BRAIN_FALSE_POSITIVE")?.humanReviewRequired,
    ).toBe(true);
  });

  it("reduces coverage when an expected finding is missing", () => {
    const benchmarkCase = canonicalShadowCases[1]!;
    const complete = scoreBrainSnapshot(
      benchmarkCase,
      createBrainOnlyShadowSnapshot(benchmarkCase.publicInput),
    );
    const empty = scoreBrainSnapshot(benchmarkCase, emptyBrain(benchmarkCase.publicInput));

    expect(empty.dimensions.coverage.rawScore).toBeLessThan(complete.dimensions.coverage.rawScore);
    expect(empty.missingExpectedItems.length).toBeGreaterThan(complete.missingExpectedItems.length);
  });

  it("suppresses adds-value when unsupported ROI is present", () => {
    const benchmarkCase = canonicalShadowCases.find(
      (item) => item.publicInput.caseId === "sales_lead_qualification",
    )!;
    const canonical = createCanonicalBenchmarkSnapshot(benchmarkCase.publicInput);
    const brain = {
      ...createBrainOnlyShadowSnapshot(benchmarkCase.publicInput),
      economicAssessment: {
        direction: "POSITIVE" as const,
        confidence: 0.91,
        evidenceRefs: [],
        numericClaims: ["Guaranteed 37.4 percent revenue uplift"],
        missingInputs: [],
      },
    };
    const brainScore = scoreBrainSnapshot(benchmarkCase, brain);
    const divergences = classifyBenchmarkDivergences({
      benchmarkCase,
      canonical,
      brain,
      canonicalScore: scoreBrainSnapshot(benchmarkCase, mirrorAsBrain(benchmarkCase.publicInput)),
      brainScore,
    });

    expect(brainScore.unsupportedRoiClaimCount).toBeGreaterThan(0);
    expect(brainScore.dimensions.roiCredibility.rawScore).toBe(0);
    expect(divergences.map((item) => item.type)).not.toContain("BRAIN_ADDS_VALUE");
    expect(divergences.find((item) => item.type === "ROI_DISAGREEMENT")?.humanReviewRequired).toBe(
      true,
    );
  });

  it("detects priority mutation", () => {
    const benchmarkCase = canonicalShadowCases[0]!;
    const canonical = createCanonicalBenchmarkSnapshot(benchmarkCase.publicInput);
    const brain = createBrainOnlyShadowSnapshot(benchmarkCase.publicInput);
    const mutated = { ...brain, priorities: [...brain.priorities].reverse() };
    const mutatedScore = scoreBrainSnapshot(benchmarkCase, mutated);
    const divergences = classifyBenchmarkDivergences({
      benchmarkCase,
      canonical,
      brain: mutated,
      canonicalScore: scoreBrainSnapshot(benchmarkCase, mirrorAsBrain(benchmarkCase.publicInput)),
      brainScore: mutatedScore,
    });

    expect(mutatedScore.priorityScore).toBeLessThan(
      scoreBrainSnapshot(benchmarkCase, brain).priorityScore,
    );
    expect(divergences.map((item) => item.type)).toContain("PRIORITY_DISAGREEMENT");
  });

  it("does not treat mirrored Canonical as added value", () => {
    const result = runCanonicalShadowBenchmark({
      caseIds: ["manual_invoice_processing"],
      codeSha: "fixed-sha",
      brainOnlyRunner: mirrorAsBrain,
      hybridRunner: (publicInput) => mirrorAsBrain(publicInput),
    });

    expect(result.perCase[0]?.brainOnlyDelta).toBe(0);
    expect(result.perCase[0]?.brainOnlyIncrementalValue).toBe(false);
    expect(result.perCase[0]?.hybridIncrementalValue).toBe(false);
  });

  it("does not reward empty Brain output as added value", () => {
    const result = runCanonicalShadowBenchmark({
      caseIds: ["manual_invoice_processing"],
      codeSha: "fixed-sha",
      brainOnlyRunner: emptyBrain,
      hybridRunner: emptyBrain,
    });

    expect(result.perCase[0]?.brainOnlyIncrementalValue).toBe(false);
    expect(result.perCase[0]?.hybridIncrementalValue).toBe(false);
    expect(result.perCase[0]?.brainOnlyScore.overall).toBeLessThan(
      result.perCase[0]!.canonicalScore.overall,
    );
  });

  it("materially degrades when scored against shuffled ground truth", () => {
    const source = canonicalShadowCases[0]!;
    const shuffledTruth = canonicalShadowCases[1]!;
    const brain = createBrainOnlyShadowSnapshot(source.publicInput);

    expect(scoreBrainSnapshot(shuffledTruth, brain).overall).toBeLessThan(
      scoreBrainSnapshot(source, brain).overall - 25,
    );
  });

  it("allows supported additional Brain insight to count as added value", () => {
    const result = runCanonicalShadowBenchmark({
      caseIds: ["manual_invoice_processing"],
      codeSha: "fixed-sha",
      brainOnlyRunner: (publicInput) =>
        withBrainOpportunity(createBrainOnlyShadowSnapshot(publicInput), {
          id: "brain:status-visibility:adds-value",
          title: "Expose invoice waiting status",
          conceptIds: ["status_visibility"],
          evidenceRefs: ["evidence:invoice:approval"],
          priorityRank: 3,
          decision: "RECOMMEND",
          confidence: 0.86,
        }),
    });

    expect(result.perCase[0]?.brainOnlyIncrementalValue).toBe(true);
  });

  it("keeps promotion impossible for the V3 design suite", () => {
    const result = runCanonicalShadowBenchmark({ codeSha: "fixed-sha" });

    expect(result.caseCount).toBe(25);
    expect(result.promotionEligible).toBe(false);
    expect(result.promotionRationale).toContain("diagnostic");
  });

  it("produces deterministic output for identical inputs", () => {
    const first = runCanonicalShadowBenchmark({ codeSha: "fixed-sha" });
    const second = runCanonicalShadowBenchmark({ codeSha: "fixed-sha" });

    expect(first).toEqual(second);
  });
});

function conceptIds(hiddenJson: string): readonly string[] {
  return [...hiddenJson.matchAll(/"[a-z0-9]+(?:_[a-z0-9]+)+"/g)].map((match) =>
    match[0]!.replaceAll('"', ""),
  );
}

function distribution(field: "expectedOutcome"): Record<string, number> {
  const counts: Record<string, number> = {
    AUTOMATE_NOW: 0,
    AUTOMATE_AFTER_REMEDIATION: 0,
    NEEDS_MORE_EVIDENCE: 0,
    DEFER: 0,
    DO_NOT_AUTOMATE: 0,
  };

  for (const benchmarkCase of canonicalShadowCases) {
    counts[benchmarkCase.scoringMetadata[field]] += 1;
  }

  return counts;
}

function countFlag(
  field:
    | "adversarial"
    | "uncertaintyRequired"
    | "roiIndeterminate"
    | "humanReviewRequired"
    | "multiOpportunity",
): number {
  return canonicalShadowCases.filter((benchmarkCase) => benchmarkCase.scoringMetadata[field])
    .length;
}

function emptyBrain(publicInput: BenchmarkPublicInput): BrainShadowBenchmarkSnapshot {
  return {
    caseId: publicInput.caseId,
    claims: [],
    evidenceRefs: [],
    unknowns: [],
    contradictions: [],
    rootCauses: [],
    bottlenecks: [],
    opportunityDecisions: [],
    priorities: [],
    economicAssessment: {
      direction: "INSUFFICIENT_EVIDENCE",
      confidence: 0,
      evidenceRefs: [],
      numericClaims: [],
      missingInputs: ["no shadow output"],
    },
    critiques: [],
    confidence: 0,
  };
}

function mirrorAsBrain(publicInput: BenchmarkPublicInput): BrainShadowBenchmarkSnapshot {
  const canonical = createCanonicalBenchmarkSnapshot(publicInput);
  return {
    caseId: publicInput.caseId,
    claims: canonical.businessFindings,
    evidenceRefs: canonical.executiveResult.evidenceRefs,
    unknowns: [],
    contradictions: [],
    rootCauses: [],
    bottlenecks: [],
    opportunityDecisions: canonical.recommendations,
    priorities: canonical.recommendations.map((item) => item.conceptIds[0] ?? item.id),
    economicAssessment: canonical.roi,
    critiques: [],
    confidence: 0.8,
  };
}

function withBrainOpportunity(
  snapshot: BrainShadowBenchmarkSnapshot,
  opportunity: BenchmarkOpportunityLike,
): BrainShadowBenchmarkSnapshot {
  return {
    ...snapshot,
    opportunityDecisions: [...snapshot.opportunityDecisions, opportunity],
    priorities: [opportunity.conceptIds[0] ?? opportunity.id, ...snapshot.priorities],
  };
}

function stripRunIds(snapshot: BrainShadowBenchmarkSnapshot): unknown {
  const normalized = JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>;
  normalized.caseId = "normalized";
  for (const collection of ["claims", "rootCauses", "bottlenecks", "opportunityDecisions"]) {
    normalized[collection] = (normalized[collection] as { id?: string }[]).map((item) => ({
      ...item,
      id: "normalized",
    }));
  }
  return normalized;
}
