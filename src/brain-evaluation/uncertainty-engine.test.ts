import { describe, expect, it } from "vitest";

import {
  Decision,
  DeterministicConfidenceModel,
  Evidence,
  type Claim,
  type Contradiction,
} from "./brain-contracts";
import {
  multipleAgreeingSourcesScenario,
  nonMaterialContradictionScenario,
  quantitativeContradictionScenario,
  roiBlockingContradictionScenario,
  staleEvidenceScenario,
  weakOutlierScenario,
} from "./company-scenarios";
import {
  BrainDecisionGuard,
  ClarificationRequirementGenerator,
  ContradictionDetector,
  EvidenceAgreementModel,
  MaterialityEngine,
  UncertaintyAssessment,
} from "./uncertainty-engine";

const now = new Date("2026-08-13T00:00:00.000Z");

describe("B2.2 ContradictionDetector", () => {
  it("detects quantitative conflicts without choosing a winner", () => {
    const contradictions = new ContradictionDetector().detect({
      subject: "ticket-volume",
      claims: quantitativeContradictionScenario.claims,
      evidence: allEvidence(quantitativeContradictionScenario),
      detectedAt: now,
    });

    expect(contradictions).toHaveLength(1);
    expect(contradictions[0]).toMatchObject({
      kind: "QUANTITATIVE",
      leftEvidenceIds: ["evidence:tickets-500"],
      rightEvidenceIds: ["evidence:tickets-110"],
      requiresClarification: true,
    });
  });

  it("detects stale-vs-current conflicts with lower default materiality", () => {
    const contradictions = new ContradictionDetector().detect({
      subject: "orders-volume",
      claims: staleEvidenceScenario.claims,
      evidence: allEvidence(staleEvidenceScenario),
      detectedAt: now,
    });

    expect(contradictions[0]?.kind).toBe("QUANTITATIVE");
    expect(allEvidence(staleEvidenceScenario).some((item) => item.freshness === "STALE")).toBe(
      true,
    );
  });

  it("detects evidence-vs-assumption conflicts", () => {
    const assumption = Evidence.create({
      evidenceId: "evidence:assumption-999",
      sourceType: "DECLARED",
      sourceReference: "assumption:roi",
      sourceModule: "brain_evaluation",
      capturedAt: now,
      freshness: "CURRENT",
      reliability: 0.5,
      content: "ROI assumption uses 999 transactions.",
      structuredValue: { ticketsPerMonth: 999 },
      provenance: { fixture: true },
    });

    const contradictions = new ContradictionDetector().detect({
      subject: "ticket-volume",
      claims: quantitativeContradictionScenario.claims,
      evidence: allEvidence(quantitativeContradictionScenario),
      assumptions: [assumption],
      detectedAt: now,
    });

    expect(contradictions.some((item) => item.kind === "EVIDENCE_VS_ASSUMPTION")).toBe(true);
  });
});

describe("B2.2 EvidenceAgreementModel", () => {
  it("returns deterministic agreement for same inputs", () => {
    const model = new EvidenceAgreementModel();
    const evidence = allEvidence(multipleAgreeingSourcesScenario);

    expect(model.assess("records-volume", evidence)).toEqual(
      model.assess("records-volume", evidence),
    );
  });

  it("shows high agreement across multiple strong sources", () => {
    const agreement = new EvidenceAgreementModel().assess(
      "records-volume",
      allEvidence(multipleAgreeingSourcesScenario),
    );

    expect(agreement.strongAgreementCount).toBe(3);
    expect(agreement.weightedAgreementScore).toBeGreaterThan(0.8);
  });

  it("does not let one weak outlier outweigh multiple strong agreeing sources", () => {
    const agreement = new EvidenceAgreementModel().assess(
      "records-volume",
      allEvidence(weakOutlierScenario),
    );

    expect(agreement.strongAgreementCount).toBe(2);
    expect(agreement.weakOutlierCount).toBe(1);
    expect(agreement.rationale).toContain("does not choose");
  });
});

describe("B2.2 UncertaintyAssessment", () => {
  it("lowers confidence adjustment when a material contradiction exists", () => {
    const claim = roiBlockingContradictionScenario.claims[0]!;
    const evidence = allEvidence(roiBlockingContradictionScenario);
    const agreement = new EvidenceAgreementModel().assess("annual-cost", evidence);
    const withContradiction = assess(
      claim,
      evidence,
      agreement,
      roiBlockingContradictionScenario.contradictions,
    );
    const withoutContradiction = assess(claim, evidence, agreement, []);

    expect(withContradiction.uncertaintyScore).toBeGreaterThan(
      withoutContradiction.uncertaintyScore,
    );
    expect(withContradiction.confidenceAdjustment).toBeLessThan(
      withoutContradiction.confidenceAdjustment,
    );
  });

  it("assigns lower freshness weight to stale evidence", () => {
    const claim = staleEvidenceScenario.claims[1]!;
    const evidence = allEvidence(staleEvidenceScenario).filter((item) =>
      claim.supportingEvidenceIds.includes(item.evidenceId),
    );
    const agreement = new EvidenceAgreementModel().assess("orders-volume", evidence);
    const result = assess(claim, evidence, agreement, []);

    expect(result.factors.averageFreshness).toBe(0.35);
    expect(result.uncertaintyScore).toBeGreaterThan(0.1);
  });

  it("does not silently average contradictory quantitative values into fake truth", () => {
    const agreement = new EvidenceAgreementModel().assess(
      "annual-cost",
      allEvidence(roiBlockingContradictionScenario),
    );

    expect(agreement.disagreementScore).toBe(1);
    expect(agreement.rationale).toContain("does not choose");
    expect(roiBlockingContradictionScenario.knownUnknowns[0]?.missingField).toBe(
      "validatedAnnualCost",
    );
  });
});

describe("B2.2 Materiality, clarification and decision guard", () => {
  it("forces NEED_MORE_EVIDENCE for unresolved material ROI contradiction", () => {
    const contradiction = roiBlockingContradictionScenario.contradictions[0]!;
    const materiality = new MaterialityEngine().assess(contradiction, "roi");
    const clarification = new ClarificationRequirementGenerator().generate({
      subject: "annual-cost",
      contradictions: [contradiction],
      target: "roi",
      materiality: [materiality],
    });
    const decision = recommendationDecision(
      "decision:roi",
      roiBlockingContradictionScenario.claims[0]!,
    );

    const guard = new BrainDecisionGuard().evaluate({
      decision,
      materiality: [materiality],
      clarifications: clarification,
    });

    expect(materiality.material).toBe(true);
    expect(clarification[0]).toMatchObject({
      targetSubject: "annual-cost",
      requiredEvidenceType: "METRIC",
      priority: "HIGH",
    });
    expect(guard).toMatchObject({ blocked: true, decisionType: "NEED_MORE_EVIDENCE" });
  });

  it("does not block unrelated decisions for non-material contradiction", () => {
    const contradiction = nonMaterialContradictionScenario.contradictions[0]!;
    const materiality = new MaterialityEngine().assess(contradiction, "finding");
    const decision = recommendationDecision(
      "decision:label",
      nonMaterialContradictionScenario.claims[0]!,
    );

    const guard = new BrainDecisionGuard().evaluate({
      decision,
      materiality: [materiality],
      clarifications: [],
    });

    expect(materiality.material).toBe(false);
    expect(guard).toMatchObject({ blocked: false, decisionType: "RECOMMEND" });
  });
});

function assess(
  claim: Claim,
  evidence: readonly Evidence[],
  agreement: ReturnType<EvidenceAgreementModel["assess"]>,
  contradictions: readonly Contradiction[],
) {
  return new UncertaintyAssessment().assess({
    claim,
    evidence,
    agreement,
    contradictions,
    unknowns: [],
    inferenceDepth: claim.kind === "FACT" ? 0 : 1,
  });
}

function recommendationDecision(decisionId: string, claim: Claim) {
  return Decision.create({
    decisionId,
    subjectId: claim.claimId,
    decisionType: "RECOMMEND",
    rationale: "Fixture decision for guard testing",
    supportingClaimIds: [claim.claimId],
    confidence: new DeterministicConfidenceModel().calculate({
      supportingEvidenceCount: claim.supportingEvidenceIds.length,
      averageSourceReliability: 0.8,
      sourceAgreement: 0.8,
      freshness: 1,
      directness: 1,
      contradictionPenalty: 0,
      missingDataPenalty: 0,
    }),
    generatedByModule: "brain_evaluation",
  });
}

function allEvidence(scenario: {
  readonly evidence?: readonly Evidence[];
  readonly interviewEvidence: readonly Evidence[];
  readonly documents: readonly Evidence[];
  readonly metrics: readonly Evidence[];
}) {
  if (scenario.evidence) return [...scenario.evidence];
  return [...scenario.interviewEvidence, ...scenario.documents, ...scenario.metrics];
}
