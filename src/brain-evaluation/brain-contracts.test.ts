import { describe, expect, it } from "vitest";

import {
  BrainContractError,
  Claim,
  Contradiction,
  DeterministicConfidenceModel,
  Evidence,
  ReasoningTrace,
  UnknownInformation,
} from "./brain-contracts";
import {
  baselineScenarios,
  contradictoryEvidenceScenario,
  doNotAutomateScenario,
  highValueAutomationScenario,
  ScenarioInvariantEvaluator,
} from "./company-scenarios";

const now = new Date("2026-08-13T00:00:00.000Z");
const confidence = new DeterministicConfidenceModel().calculate({
  supportingEvidenceCount: 1,
  averageSourceReliability: 0.9,
  sourceAgreement: 0.9,
  freshness: 1,
  directness: 1,
  contradictionPenalty: 0,
  missingDataPenalty: 0,
});

describe("Brain V2 contracts", () => {
  it("requires Evidence for FACT claims", () => {
    expect(() =>
      Claim.create({
        claimId: "claim:fact-without-evidence",
        kind: "FACT",
        statement: "The process has measurable volume.",
        supportingEvidenceIds: [],
        confidence,
        rationale: "Invalid fact",
        createdByModule: "brain_evaluation",
        createdAt: now,
        lastEvaluatedAt: now,
      }),
    ).toThrow(BrainContractError);
  });

  it("keeps UNKNOWN distinct from false, zero and empty values", () => {
    const unknown = Claim.create({
      claimId: "claim:unknown-volume",
      kind: "UNKNOWN",
      statement: "Validated daily volume is unknown.",
      supportingEvidenceIds: [],
      confidence: new DeterministicConfidenceModel().calculate({
        supportingEvidenceCount: 0,
        averageSourceReliability: 0,
        sourceAgreement: 0,
        freshness: 0,
        directness: 0,
        contradictionPenalty: 0,
        missingDataPenalty: 1,
      }),
      rationale: "No authoritative source has supplied the value.",
      createdByModule: "brain_evaluation",
      createdAt: now,
      lastEvaluatedAt: now,
    });
    const missing = UnknownInformation.create({
      unknownId: "unknown:volume",
      missingField: "dailyVolume",
      domain: "roi",
      reason: "not supplied",
      impact: "ROI cannot be computed confidently.",
      requiredFor: ["roi"],
      priority: "HIGH",
      suggestedClarification: "Provide measured daily volume.",
    });

    expect(unknown.kind).toBe("UNKNOWN");
    expect(missing.missingField).not.toBe("");
    expect(missing.missingField).not.toBe("false");
    expect(missing.missingField).not.toBe("0");
  });

  it("preserves both sides of a contradiction", () => {
    const contradiction = Contradiction.create({
      contradictionId: "contradiction:test-volume",
      kind: "QUANTITATIVE",
      leftClaimId: "claim:left",
      rightClaimId: "claim:right",
      leftEvidenceIds: ["evidence:left"],
      rightEvidenceIds: ["evidence:right"],
      materiality: "HIGH",
      impact: "ROI assumption cannot be trusted.",
      requiresClarification: true,
      detectedAt: now,
    });

    expect(contradiction.leftEvidenceIds).toEqual(["evidence:left"]);
    expect(contradiction.rightEvidenceIds).toEqual(["evidence:right"]);
    expect(contradiction.requiresClarification).toBe(true);
  });

  it("produces deterministic confidence for identical factors", () => {
    const model = new DeterministicConfidenceModel();
    const factors = {
      supportingEvidenceCount: 3,
      averageSourceReliability: 0.8,
      sourceAgreement: 0.75,
      freshness: 0.9,
      directness: 1,
      contradictionPenalty: 0.1,
      missingDataPenalty: 0.2,
    };

    expect(model.calculate(factors)).toEqual(model.calculate(factors));
  });

  it("supports backward and forward reasoning trace traversal", () => {
    const trace = ReasoningTrace.create(
      {
        "evidence:1": "Evidence",
        "claim:1": "Claim",
        "decision:1": "Decision",
      },
      [
        {
          fromId: "evidence:1",
          toId: "claim:1",
          relationship: "supports",
          rationale: "Evidence supports fact claim.",
        },
        {
          fromId: "claim:1",
          toId: "decision:1",
          relationship: "supports",
          rationale: "Claim supports decision.",
        },
      ],
    );

    expect(trace.forward("evidence:1")).toHaveLength(1);
    expect(trace.backward("decision:1")).toHaveLength(1);
  });

  it("keeps Evidence limited to observed or supplied information", () => {
    const evidence = Evidence.create({
      evidenceId: "evidence:observed-volume",
      sourceType: "OBSERVED",
      sourceReference: "fixture",
      sourceModule: "brain_evaluation",
      capturedAt: now,
      freshness: "CURRENT",
      reliability: 0.9,
      content: "Observed 40 cases in one day.",
      structuredValue: { dailyCases: 40 },
      provenance: { fixture: true },
    });

    expect(evidence.sourceType).toBe("OBSERVED");
    expect(evidence.content).toContain("Observed");
  });
});

describe("Brain evaluation harness foundation", () => {
  it("provides the three deterministic baseline scenarios", () => {
    expect(baselineScenarios.map((item) => item.scenarioId)).toEqual([
      "scenario:high-value-automation",
      "scenario:do-not-automate",
      "scenario:contradictory-evidence",
    ]);
  });

  it("marks the high-value fixture as automation-eligible", () => {
    const assessment = new ScenarioInvariantEvaluator().assess(highValueAutomationScenario);

    expect(assessment.decisionType).toBe("RECOMMEND");
    expect(highValueAutomationScenario.expectedOpportunities).toContain(
      "invoice_reconciliation_automation",
    );
  });

  it("keeps the do-not-automate fixture rejectable", () => {
    const assessment = new ScenarioInvariantEvaluator().assess(doNotAutomateScenario);

    expect(assessment.decisionType).toBe("REJECT");
    expect(doNotAutomateScenario.expectedOpportunities).toHaveLength(0);
    expect(doNotAutomateScenario.forbiddenRecommendations).toContain("paid_integration_project");
  });

  it("blocks high-confidence quantitative conclusions for contradictory evidence", () => {
    const assessment = new ScenarioInvariantEvaluator().assess(contradictoryEvidenceScenario);

    expect(assessment.decisionType).toBe("NEED_MORE_EVIDENCE");
    expect(assessment.requiresClarification).toBe(true);
    expect(assessment.highConfidenceQuantitativeConclusionAllowed).toBe(false);
  });

  it("does not silently select the larger quantitative value in a contradiction", () => {
    const ownerClaim = contradictoryEvidenceScenario.claims.find(
      (claim) => claim.claimId === "claim:owner-volume",
    );

    expect(ownerClaim?.status).toBe("CONTRADICTED");
    expect(ownerClaim?.confidence.value).toBeLessThan(0.7);
    expect(contradictoryEvidenceScenario.knownUnknowns[0]?.missingField).toBe(
      "validatedDailyTransactionVolume",
    );
  });
});
