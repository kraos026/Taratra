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
  readonly evidence: readonly Evidence[];
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

export const quantitativeContradictionScenario = scenario({
  scenarioId: "scenario:quantitative-contradiction",
  title: "Quantitative contradiction",
  companyProfile: { industry: "generic services", employees: 18 },
  actors: ["manager", "analyst"],
  systems: ["Ticketing"],
  processDescriptions: ["Monthly support ticket volume is reported with incompatible values."],
  evidence: [
    evidence({
      evidenceId: "evidence:tickets-500",
      sourceType: "METRIC",
      content: "Dashboard export reports 500 tickets per month.",
      structuredValue: { ticketsPerMonth: 500 },
      reliability: 0.9,
    }),
    evidence({
      evidenceId: "evidence:tickets-110",
      sourceType: "INTERVIEW",
      sourceReference: "interview:manager",
      content: "Manager reports roughly 110 tickets per month.",
      structuredValue: { ticketsPerMonth: 110 },
      reliability: 0.72,
    }),
  ],
  claims: [
    claim({
      claimId: "claim:tickets-500",
      kind: "FACT",
      statement: "Monthly ticket volume is 500.",
      supportingEvidenceIds: ["evidence:tickets-500"],
      confidenceValue: 0.65,
      status: "CONTRADICTED",
    }),
    claim({
      claimId: "claim:tickets-110",
      kind: "FACT",
      statement: "Monthly ticket volume is 110.",
      supportingEvidenceIds: ["evidence:tickets-110"],
      confidenceValue: 0.52,
      status: "CONTRADICTED",
    }),
  ],
  expectedFindings: ["quantitative_conflict"],
  expectedOpportunities: [],
  forbiddenRecommendations: ["high_confidence_roi"],
});

export const staleEvidenceScenario = scenario({
  scenarioId: "scenario:stale-evidence",
  title: "Stale evidence",
  companyProfile: { industry: "generic services", employees: 30 },
  actors: ["operations"],
  systems: ["ERP"],
  processDescriptions: ["An old export conflicts with current operational volume."],
  evidence: [
    evidence({
      evidenceId: "evidence:current-300",
      sourceType: "SYSTEM_RECORD",
      content: "Current system report shows 300 orders per month.",
      structuredValue: { ordersPerMonth: 300 },
      reliability: 0.92,
      freshness: "CURRENT",
    }),
    evidence({
      evidenceId: "evidence:stale-40",
      sourceType: "DOCUMENT",
      content: "Old spreadsheet shows 40 orders per month.",
      structuredValue: { ordersPerMonth: 40 },
      reliability: 0.75,
      freshness: "STALE",
    }),
  ],
  claims: [
    claim({
      claimId: "claim:current-orders",
      kind: "FACT",
      statement: "Current order volume is 300 per month.",
      supportingEvidenceIds: ["evidence:current-300"],
      confidenceValue: 0.8,
    }),
    claim({
      claimId: "claim:stale-orders",
      kind: "FACT",
      statement: "Old order volume was 40 per month.",
      supportingEvidenceIds: ["evidence:stale-40"],
      confidenceValue: 0.42,
    }),
  ],
  expectedFindings: ["stale_evidence"],
  expectedOpportunities: [],
  forbiddenRecommendations: [],
});

export const multipleAgreeingSourcesScenario = scenario({
  scenarioId: "scenario:multiple-agreeing-sources",
  title: "Multiple agreeing sources",
  companyProfile: { industry: "generic services", employees: 52 },
  actors: ["team lead", "operator"],
  systems: ["CRM", "BI"],
  processDescriptions: ["Three independent sources agree on repetitive workload."],
  evidence: [
    evidence({
      evidenceId: "evidence:agree-1",
      sourceType: "METRIC",
      content: "BI report shows 400 records per month.",
      structuredValue: { recordsPerMonth: 400 },
      reliability: 0.9,
    }),
    evidence({
      evidenceId: "evidence:agree-2",
      sourceType: "SYSTEM_RECORD",
      content: "CRM export shows 390 records per month.",
      structuredValue: { recordsPerMonth: 390 },
      reliability: 0.88,
    }),
    evidence({
      evidenceId: "evidence:agree-3",
      sourceType: "INTERVIEW",
      content: "Operator estimates about 410 records per month.",
      structuredValue: { recordsPerMonth: 410 },
      reliability: 0.82,
    }),
  ],
  claims: [
    claim({
      claimId: "claim:agreeing-volume",
      kind: "FACT",
      statement: "Monthly volume is consistently around 400 records.",
      supportingEvidenceIds: ["evidence:agree-1", "evidence:agree-2", "evidence:agree-3"],
      confidenceValue: 0.9,
    }),
  ],
  expectedFindings: ["source_agreement"],
  expectedOpportunities: ["records_workflow_automation"],
  forbiddenRecommendations: [],
});

export const weakOutlierScenario = scenario({
  scenarioId: "scenario:weak-outlier",
  title: "One weak outlier source",
  companyProfile: { industry: "generic services", employees: 40 },
  actors: ["operator", "temporary assistant"],
  systems: ["CRM"],
  processDescriptions: ["Strong sources agree while one weak source reports an outlier."],
  evidence: [
    evidence({
      evidenceId: "evidence:strong-1",
      sourceType: "METRIC",
      content: "System report shows 200 records per month.",
      structuredValue: { recordsPerMonth: 200 },
      reliability: 0.95,
    }),
    evidence({
      evidenceId: "evidence:strong-2",
      sourceType: "SYSTEM_RECORD",
      content: "Export shows 205 records per month.",
      structuredValue: { recordsPerMonth: 205 },
      reliability: 0.9,
    }),
    evidence({
      evidenceId: "evidence:weak-outlier",
      sourceType: "INTERVIEW",
      sourceReference: "interview:temporary-assistant",
      content: "Temporary assistant recalls 20 records per month.",
      structuredValue: { recordsPerMonth: 20 },
      reliability: 0.2,
    }),
  ],
  claims: [
    claim({
      claimId: "claim:strong-volume",
      kind: "FACT",
      statement: "Monthly volume is near 200 records.",
      supportingEvidenceIds: ["evidence:strong-1", "evidence:strong-2"],
      confidenceValue: 0.86,
    }),
    claim({
      claimId: "claim:weak-volume",
      kind: "FACT",
      statement: "Monthly volume is 20 records.",
      supportingEvidenceIds: ["evidence:weak-outlier"],
      confidenceValue: 0.18,
      status: "CONTRADICTED",
    }),
  ],
  expectedFindings: ["weak_outlier"],
  expectedOpportunities: ["records_workflow_automation"],
  forbiddenRecommendations: [],
});

export const nonMaterialContradictionScenario = scenario({
  scenarioId: "scenario:non-material-contradiction",
  title: "Non-material contradiction",
  companyProfile: { industry: "generic services", employees: 16 },
  actors: ["sales", "support"],
  systems: ["CRM"],
  processDescriptions: ["Actors disagree on a label that does not affect ROI or recommendation."],
  evidence: [
    evidence({
      evidenceId: "evidence:label-sales",
      sourceType: "INTERVIEW",
      sourceReference: "interview:sales",
      content: "Sales calls the workflow lead follow-up.",
      structuredValue: { workflowLabel: "lead follow-up" },
      reliability: 0.8,
    }),
    evidence({
      evidenceId: "evidence:label-support",
      sourceType: "INTERVIEW",
      sourceReference: "interview:support",
      content: "Support calls the workflow customer callback.",
      structuredValue: { workflowLabel: "customer callback" },
      reliability: 0.78,
    }),
  ],
  claims: [
    claim({
      claimId: "claim:label-sales",
      kind: "FACT",
      statement: "Workflow label is lead follow-up.",
      supportingEvidenceIds: ["evidence:label-sales"],
      confidenceValue: 0.45,
    }),
    claim({
      claimId: "claim:label-support",
      kind: "FACT",
      statement: "Workflow label is customer callback.",
      supportingEvidenceIds: ["evidence:label-support"],
      confidenceValue: 0.45,
    }),
  ],
  contradictions: [
    Contradiction.create({
      contradictionId: "contradiction:workflow-label",
      kind: "QUALITATIVE",
      leftClaimId: "claim:label-sales",
      rightClaimId: "claim:label-support",
      leftEvidenceIds: ["evidence:label-sales"],
      rightEvidenceIds: ["evidence:label-support"],
      materiality: "LOW",
      impact: "Naming disagreement does not affect ROI.",
      requiresClarification: false,
      detectedAt: now,
    }),
  ],
  expectedFindings: ["label_disagreement"],
  expectedOpportunities: ["callback_workflow_improvement"],
  forbiddenRecommendations: [],
});

export const roiBlockingContradictionScenario = scenario({
  scenarioId: "scenario:roi-blocking-contradiction",
  title: "Contradiction that blocks ROI",
  companyProfile: { industry: "generic services", employees: 34 },
  actors: ["finance", "operations"],
  systems: ["Accounting", "ERP"],
  processDescriptions: ["The same process has incompatible cost assumptions."],
  evidence: [
    evidence({
      evidenceId: "evidence:finance-cost",
      sourceType: "METRIC",
      sourceReference: "finance:export",
      content: "Finance export says the annual cost is 90,000.",
      structuredValue: { annualCost: 90000 },
      reliability: 0.92,
    }),
    evidence({
      evidenceId: "evidence:ops-cost",
      sourceType: "INTERVIEW",
      sourceReference: "interview:operations",
      content: "Operations reports annual cost around 9,000.",
      structuredValue: { annualCost: 9000 },
      reliability: 0.78,
    }),
  ],
  claims: [
    claim({
      claimId: "claim:finance-cost",
      kind: "FACT",
      statement: "Annual cost is 90,000.",
      supportingEvidenceIds: ["evidence:finance-cost"],
      confidenceValue: 0.58,
      status: "CONTRADICTED",
    }),
    claim({
      claimId: "claim:ops-cost",
      kind: "FACT",
      statement: "Annual cost is 9,000.",
      supportingEvidenceIds: ["evidence:ops-cost"],
      confidenceValue: 0.5,
      status: "CONTRADICTED",
    }),
  ],
  contradictions: [
    contradiction({
      contradictionId: "contradiction:annual-cost",
      leftClaimId: "claim:finance-cost",
      rightClaimId: "claim:ops-cost",
      leftEvidenceIds: ["evidence:finance-cost"],
      rightEvidenceIds: ["evidence:ops-cost"],
      impact: "ROI cost assumption is materially contradictory.",
    }),
  ],
  knownUnknowns: [
    unknown({
      unknownId: "unknown:validated-annual-cost",
      missingField: "validatedAnnualCost",
      impact: "Blocks ROI decision.",
      requiredFor: ["roi", "recommendations"],
    }),
  ],
  expectedFindings: ["roi_cost_contradiction"],
  expectedOpportunities: [],
  forbiddenRecommendations: ["roi_based_recommendation"],
});

export const baselineScenarios = Object.freeze([
  highValueAutomationScenario,
  doNotAutomateScenario,
  contradictoryEvidenceScenario,
]);

export const uncertaintyScenarios = Object.freeze([
  quantitativeContradictionScenario,
  staleEvidenceScenario,
  multipleAgreeingSourcesScenario,
  weakOutlierScenario,
  nonMaterialContradictionScenario,
  roiBlockingContradictionScenario,
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
    evidence: Object.freeze([...input.evidence]),
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
