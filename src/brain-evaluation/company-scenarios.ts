import {
  Claim,
  Contradiction,
  DeterministicConfidenceModel,
  Evidence,
  UnknownInformation,
  type ClaimInput,
  type ContradictionInput,
  type DecisionType,
  type EvidenceInput,
  type UnknownInformationInput,
} from "./brain-contracts";

export interface CompanyScenario {
  readonly scenarioId: string;
  readonly title: string;
  readonly companyProfile: Readonly<Record<string, unknown>>;
  readonly actors: readonly string[];
  readonly systems: readonly string[];
  readonly processDescriptions: readonly string[];
  readonly interviewEvidence: readonly Evidence[];
  readonly documents: readonly Evidence[];
  readonly metrics: readonly Evidence[];
  readonly constraints: readonly string[];
  readonly knownUnknowns: readonly UnknownInformation[];
  readonly claims: readonly Claim[];
  readonly contradictions: readonly Contradiction[];
  readonly expectedFindings: readonly string[];
  readonly expectedOpportunities: readonly string[];
  readonly forbiddenRecommendations: readonly string[];
}

export interface ScenarioAssessment {
  readonly scenarioId: string;
  readonly decisionType: DecisionType;
  readonly requiresClarification: boolean;
  readonly highConfidenceQuantitativeConclusionAllowed: boolean;
  readonly rationale: string;
}

const now = new Date("2026-08-13T00:00:00.000Z");
const confidenceModel = new DeterministicConfidenceModel();

export const highValueAutomationScenario = scenario({
  scenarioId: "scenario:high-value-automation",
  title: "High-value automation case",
  companyProfile: { industry: "generic services", employees: 45 },
  actors: ["operations lead", "billing clerk"],
  systems: ["ERP", "Spreadsheet", "Email"],
  processDescriptions: ["Daily invoice reconciliation is manually copied between systems."],
  evidence: [
    evidence({
      evidenceId: "evidence:high-volume",
      sourceType: "METRIC",
      content: "Team handles 850 reconciliation transactions per month.",
      structuredValue: { transactionsPerMonth: 850 },
      reliability: 0.9,
    }),
    evidence({
      evidenceId: "evidence:manual-time",
      sourceType: "OBSERVED",
      content: "Observed average handling time is six minutes per transaction.",
      structuredValue: { minutesPerTransaction: 6 },
      reliability: 0.85,
    }),
    evidence({
      evidenceId: "evidence:error-rate",
      sourceType: "METRIC",
      content: "Error rate is measured at 4.2 percent.",
      structuredValue: { errorRate: 0.042 },
      reliability: 0.8,
    }),
  ],
  claims: [
    claim({
      claimId: "claim:high-value-repetitive",
      kind: "FACT",
      statement: "The process has high repetitive manual volume.",
      supportingEvidenceIds: ["evidence:high-volume", "evidence:manual-time"],
      confidenceValue: 0.86,
    }),
  ],
  constraints: ["Integration is available through existing systems."],
  expectedFindings: ["repetitive_manual_work", "measurable_labor_time"],
  expectedOpportunities: ["invoice_reconciliation_automation"],
  forbiddenRecommendations: [],
});

export const doNotAutomateScenario = scenario({
  scenarioId: "scenario:do-not-automate",
  title: "Do-not-automate case",
  companyProfile: { industry: "generic services", employees: 8 },
  actors: ["owner"],
  systems: ["Spreadsheet"],
  processDescriptions: ["A monthly checklist is manually updated for a rare edge case."],
  evidence: [
    evidence({
      evidenceId: "evidence:low-volume",
      sourceType: "METRIC",
      content: "The task occurs two times per month.",
      structuredValue: { transactionsPerMonth: 2 },
      reliability: 0.9,
    }),
    evidence({
      evidenceId: "evidence:low-cost",
      sourceType: "METRIC",
      content: "Annual labor cost is below expected implementation cost.",
      structuredValue: { annualLaborCost: 120, implementationCost: 3000 },
      reliability: 0.85,
    }),
  ],
  claims: [
    claim({
      claimId: "claim:low-value",
      kind: "FACT",
      statement: "The automation value is below the implementation threshold.",
      supportingEvidenceIds: ["evidence:low-volume", "evidence:low-cost"],
      confidenceValue: 0.88,
    }),
  ],
  constraints: ["Implementation cost exceeds likely benefit."],
  expectedFindings: ["low_volume"],
  expectedOpportunities: [],
  forbiddenRecommendations: ["autonomous_automation", "paid_integration_project"],
});

export const contradictoryEvidenceScenario = scenario({
  scenarioId: "scenario:contradictory-evidence",
  title: "Contradictory-evidence case",
  companyProfile: { industry: "generic services", employees: 22 },
  actors: ["owner", "operator"],
  systems: ["CRM"],
  processDescriptions: ["Daily lead handling volume is reported inconsistently."],
  evidence: [
    evidence({
      evidenceId: "evidence:owner-70",
      sourceType: "INTERVIEW",
      sourceReference: "interview:owner",
      content: "Owner reports 70 transactions per day.",
      structuredValue: { transactionsPerDay: 70 },
      reliability: 0.7,
    }),
    evidence({
      evidenceId: "evidence:operator-25",
      sourceType: "INTERVIEW",
      sourceReference: "interview:operator",
      content: "Operator reports 20 to 30 transactions per day.",
      structuredValue: { transactionsPerDayRange: [20, 30] },
      reliability: 0.85,
    }),
  ],
  claims: [
    claim({
      claimId: "claim:owner-volume",
      kind: "FACT",
      statement: "Daily transaction volume is 70.",
      supportingEvidenceIds: ["evidence:owner-70"],
      contradictingEvidenceIds: ["evidence:operator-25"],
      confidenceValue: 0.42,
      status: "CONTRADICTED",
    }),
    claim({
      claimId: "claim:operator-volume",
      kind: "FACT",
      statement: "Daily transaction volume is between 20 and 30.",
      supportingEvidenceIds: ["evidence:operator-25"],
      contradictingEvidenceIds: ["evidence:owner-70"],
      confidenceValue: 0.48,
      status: "CONTRADICTED",
    }),
  ],
  contradictions: [
    contradiction({
      contradictionId: "contradiction:daily-volume",
      leftClaimId: "claim:owner-volume",
      rightClaimId: "claim:operator-volume",
      leftEvidenceIds: ["evidence:owner-70"],
      rightEvidenceIds: ["evidence:operator-25"],
      impact: "ROI volume assumption is materially uncertain.",
    }),
  ],
  knownUnknowns: [
    unknown({
      unknownId: "unknown:validated-daily-volume",
      missingField: "validatedDailyTransactionVolume",
      impact: "Blocks high-confidence ROI calculation.",
      requiredFor: ["roi", "recommendations"],
    }),
  ],
  expectedFindings: ["volume_contradiction"],
  expectedOpportunities: [],
  forbiddenRecommendations: ["high_confidence_roi", "autonomous_automation"],
});

export const baselineScenarios = Object.freeze([
  highValueAutomationScenario,
  doNotAutomateScenario,
  contradictoryEvidenceScenario,
]);

export class ScenarioInvariantEvaluator {
  assess(scenario: CompanyScenario): ScenarioAssessment {
    const hasMaterialContradiction = scenario.contradictions.some(
      (item) =>
        item.requiresClarification &&
        (item.materiality === "HIGH" || item.materiality === "CRITICAL"),
    );
    const blocksAutomation = scenario.forbiddenRecommendations.length > 0;
    const hasOpportunity = scenario.expectedOpportunities.length > 0;
    return Object.freeze({
      scenarioId: scenario.scenarioId,
      decisionType: hasMaterialContradiction
        ? "NEED_MORE_EVIDENCE"
        : blocksAutomation
          ? "REJECT"
          : hasOpportunity
            ? "RECOMMEND"
            : "DEFER",
      requiresClarification: hasMaterialContradiction || scenario.knownUnknowns.length > 0,
      highConfidenceQuantitativeConclusionAllowed: !hasMaterialContradiction,
      rationale: hasMaterialContradiction
        ? "Material contradiction blocks high-confidence quantitative conclusion"
        : blocksAutomation
          ? "Fixture marks automation as forbidden by expected economics or constraints"
          : "Fixture has sufficient baseline evidence for evaluation",
    });
  }
}

function scenario(input: {
  scenarioId: string;
  title: string;
  companyProfile: Readonly<Record<string, unknown>>;
  actors: readonly string[];
  systems: readonly string[];
  processDescriptions: readonly string[];
  evidence: readonly Evidence[];
  claims: readonly Claim[];
  constraints?: readonly string[];
  contradictions?: readonly Contradiction[];
  knownUnknowns?: readonly UnknownInformation[];
  expectedFindings: readonly string[];
  expectedOpportunities: readonly string[];
  forbiddenRecommendations: readonly string[];
}): CompanyScenario {
  return Object.freeze({
    scenarioId: input.scenarioId,
    title: input.title,
    companyProfile: Object.freeze({ ...input.companyProfile }),
    actors: Object.freeze([...input.actors]),
    systems: Object.freeze([...input.systems]),
    processDescriptions: Object.freeze([...input.processDescriptions]),
    interviewEvidence: Object.freeze(
      input.evidence.filter((item) => item.sourceType === "INTERVIEW"),
    ),
    documents: Object.freeze(input.evidence.filter((item) => item.sourceType === "DOCUMENT")),
    metrics: Object.freeze(input.evidence.filter((item) => item.sourceType === "METRIC")),
    constraints: Object.freeze([...(input.constraints ?? [])]),
    knownUnknowns: Object.freeze([...(input.knownUnknowns ?? [])]),
    claims: Object.freeze([...input.claims]),
    contradictions: Object.freeze([...(input.contradictions ?? [])]),
    expectedFindings: Object.freeze([...input.expectedFindings]),
    expectedOpportunities: Object.freeze([...input.expectedOpportunities]),
    forbiddenRecommendations: Object.freeze([...input.forbiddenRecommendations]),
  });
}

function evidence(input: Partial<EvidenceInput> & Pick<EvidenceInput, "evidenceId" | "content">) {
  return Evidence.create({
    sourceType: "OBSERVED",
    sourceReference: "fixture:brain-evaluation",
    sourceModule: "brain_evaluation",
    capturedAt: now,
    freshness: "CURRENT",
    reliability: 0.8,
    provenance: { fixture: true },
    ...input,
  });
}

function claim(
  input: Omit<
    ClaimInput,
    "confidence" | "rationale" | "createdByModule" | "createdAt" | "lastEvaluatedAt"
  > & {
    confidenceValue: number;
  },
) {
  return Claim.create({
    ...input,
    confidence: confidenceModel.calculate({
      supportingEvidenceCount: input.supportingEvidenceIds?.length ?? 0,
      averageSourceReliability: input.confidenceValue,
      sourceAgreement: input.status === "CONTRADICTED" ? 0.2 : 0.9,
      freshness: 1,
      directness: input.kind === "FACT" ? 1 : 0.65,
      contradictionPenalty: input.status === "CONTRADICTED" ? 0.7 : 0,
      missingDataPenalty: 0,
    }),
    rationale: "Baseline scenario claim",
    createdByModule: "brain_evaluation",
    createdAt: now,
    lastEvaluatedAt: now,
  });
}

function contradiction(
  input: Omit<ContradictionInput, "kind" | "materiality" | "requiresClarification" | "detectedAt">,
) {
  return Contradiction.create({
    ...input,
    kind: "QUANTITATIVE",
    materiality: "HIGH",
    requiresClarification: true,
    detectedAt: now,
  });
}

function unknown(
  input: Omit<UnknownInformationInput, "domain" | "reason" | "priority" | "suggestedClarification">,
) {
  return UnknownInformation.create({
    ...input,
    domain: "roi",
    reason: "Conflicting evidence prevents canonical value selection",
    priority: "HIGH",
    suggestedClarification: "Ask an authoritative actor to validate a recent measured volume.",
  });
}
