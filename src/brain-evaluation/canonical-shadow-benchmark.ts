import { Claim, DeterministicConfidenceModel, Evidence } from "./brain-contracts";
import {
  canonicalShadowBenchmarkVersion,
  canonicalShadowCases,
} from "./canonical-shadow-scenarios";
import {
  brainHasIncrementalValue,
  classifyBenchmarkDivergences,
} from "./canonical-shadow-divergence";
import {
  assertBenchmarkWeightsTotal100,
  scoreBrainSnapshot,
  scoreCanonicalSnapshot,
} from "./canonical-shadow-scorer";
import type {
  BenchmarkClaimLike,
  BenchmarkDivergenceType,
  BenchmarkOpportunityLike,
  BenchmarkPublicInput,
  BenchmarkRunResult,
  BenchmarkWinner,
  BrainShadowBenchmarkSnapshot,
  CanonicalBenchmarkSnapshot,
  HybridContribution,
  RoiDirection,
} from "./canonical-shadow-types";

export type BrainOnlyRunner = (publicInput: BenchmarkPublicInput) => BrainShadowBenchmarkSnapshot;
export type HybridRunner = (
  publicInput: BenchmarkPublicInput,
  canonicalSnapshot: CanonicalBenchmarkSnapshot,
) => BrainShadowBenchmarkSnapshot;

export interface CanonicalShadowBenchmarkOptions {
  readonly caseIds?: readonly string[];
  readonly codeSha?: string;
  readonly brainOnlyRunner?: BrainOnlyRunner;
  readonly hybridRunner?: HybridRunner;
}

const fixedBenchmarkDate = new Date("2026-08-26T00:00:00.000Z");

const conceptRules: readonly {
  readonly conceptId: string;
  readonly phrases: readonly string[];
  readonly kind: "finding" | "rootCause" | "bottleneck" | "opportunity" | "risk";
}[] = Object.freeze([
  rule("manual_invoice_processing", "finding", [
    "invoice",
    "copied manually",
    "checking and copying",
  ]),
  rule("duplicate_entry", "finding", ["entered in more than one place", "typed again", "re-enter"]),
  rule("high_manual_workload", "finding", ["45 hours", "several days", "manual finance work"]),
  rule("single_point_of_failure", "finding", [
    "one senior person",
    "manager is away",
    "manager is unavailable",
  ]),
  rule("email_dependency", "rootCause", ["shared inbox", "email", "attachments"]),
  rule("single_person_approval_dependency", "rootCause", [
    "manager is away",
    "one senior person",
    "named it approval",
  ]),
  rule("finance_manager_approval", "bottleneck", ["finance manager", "exception approval"]),
  rule("invoice_intake_automation", "opportunity", ["invoice fields", "pdf", "attachments"]),
  rule("exception_routing", "opportunity", ["exception", "approval threshold"]),
  rule("status_visibility", "opportunity", ["visibility", "waiting", "status"]),
  rule("payment_error", "risk", ["typed incorrectly", "payment amounts"]),

  rule("support_triage_overload", "finding", ["420 tickets", "half of weekly tickets", "repeat"]),
  rule("slow_first_response", "finding", ["first responses are slow", "nine hours"]),
  rule("knowledge_lookup_delay", "finding", ["approved answers", "search several places"]),
  rule("manual_ticket_classification", "rootCause", [
    "classify",
    "sorting tickets",
    "decide whether each ticket",
  ]),
  rule("fragmented_knowledge", "rootCause", ["spread across", "slack threads", "several places"]),
  rule("billing_specialist_queue", "bottleneck", ["billing cases wait", "billing specialist"]),
  rule("support_triage_assistant", "opportunity", ["sorting tickets", "classify intent", "ticket"]),
  rule("knowledge_answer_assistant", "opportunity", ["approved answer", "knowledge base"]),
  rule("billing_privacy", "risk", ["billing or privacy", "personal information"]),
  rule("human_control_required", "risk", ["human review", "must approve", "requires named"]),

  rule("onboarding_checklist_fragmentation", "finding", [
    "checklist",
    "spreadsheet and email reminders",
  ]),
  rule("manual_status_chasing", "finding", ["reminding other teams", "follows up manually"]),
  rule("it_provisioning_delay", "finding", ["account setup delays", "approvals are missed"]),
  rule("fragmented_onboarding_ownership", "rootCause", [
    "hr, it and managers",
    "coordination tasks",
  ]),
  rule("it_access_approval", "bottleneck", ["it approval", "access is granted"]),
  rule("onboarding_workflow_orchestration", "opportunity", [
    "onboarding tasks",
    "coordination tasks",
  ]),
  rule("status_reminder_automation", "opportunity", ["reminders", "follow up manually"]),
  rule("access_control_error", "risk", ["incorrect access", "security"]),
  rule("privacy_sensitive_hr_data", "risk", ["sensitive hr data", "salary", "medical"]),

  rule("inconsistent_crm_data", "finding", ["missing company size", "partial company"]),
  rule("slow_lead_followup", "finding", ["follow-up is delayed", "before assignment"]),
  rule("manual_lead_scoring", "finding", ["manual scoring", "estimates fit"]),
  rule("missing_crm_fields", "rootCause", ["missing fields", "inbound leads are missing"]),
  rule("uncertain_attribution", "rootCause", ["attribution is incomplete", "corrected after"]),
  rule("sdr_enrichment_queue", "bottleneck", ["sdr", "enrich"]),
  rule("lead_enrichment_assist", "opportunity", [
    "enrich records",
    "fill in missing",
    "missing company size",
  ]),
  rule("routing_recommendation", "opportunity", ["routing", "assignment", "wrong owner"]),
  rule("unsupported_revenue_claims", "risk", ["revenue impact", "attribution"]),

  rule("spreadsheet_reorder_logic", "finding", ["spreadsheet formulas", "reorder thresholds"]),
  rule("manual_purchase_entry", "finding", ["typed manually", "supplier portals"]),
  rule("stockout_risk", "finding", ["stockouts", "missed reorders"]),
  rule("manual_reorder_threshold_check", "rootCause", [
    "checking reorder thresholds",
    "compares spreadsheet",
  ]),
  rule("stale_inventory_export", "rootCause", ["day out of date", "old stock exports"]),
  rule("finance_purchase_approval", "bottleneck", ["finance approves", "finance approval"]),
  rule("reorder_alerting", "opportunity", ["reorder checks", "missed reorders"]),
  rule("purchase_order_draft_automation", "opportunity", ["supplier order", "purchase orders"]),
  rule("data_freshness_risk", "risk", ["data freshness", "old stock exports", "day out of date"]),
  rule("approval_control_required", "risk", ["finance control", "finance approval"]),
]);

export function runCanonicalShadowBenchmark(
  options: CanonicalShadowBenchmarkOptions = {},
): BenchmarkRunResult {
  assertBenchmarkWeightsTotal100();
  const selectedCaseIds = new Set(
    options.caseIds ?? canonicalShadowCases.map((item) => item.publicInput.caseId),
  );
  const cases = canonicalShadowCases.filter((item) => selectedCaseIds.has(item.publicInput.caseId));
  if (cases.length !== selectedCaseIds.size) {
    const known = new Set(canonicalShadowCases.map((item) => item.publicInput.caseId));
    const missing = [...selectedCaseIds].filter((caseId) => !known.has(caseId));
    throw new Error(`Unknown canonical shadow benchmark case(s): ${missing.join(", ")}`);
  }

  const perCase = cases.map((benchmarkCase) => {
    const publicInput = deepFreeze(clonePublicInput(benchmarkCase.publicInput));
    const canonicalSnapshot = createCanonicalBenchmarkSnapshot(publicInput);
    const brainOnlySnapshot = options.brainOnlyRunner
      ? options.brainOnlyRunner(publicInput)
      : createBrainOnlyShadowSnapshot(publicInput);
    const hybridSnapshot = options.hybridRunner
      ? options.hybridRunner(publicInput, canonicalSnapshot)
      : createHybridShadowSnapshot(publicInput, canonicalSnapshot);

    const canonicalScore = scoreCanonicalSnapshot(benchmarkCase, canonicalSnapshot);
    const brainOnlyScore = scoreBrainSnapshot(benchmarkCase, brainOnlySnapshot);
    const hybridScore = scoreBrainSnapshot(benchmarkCase, hybridSnapshot);
    const brainOnlyDivergences = classifyBenchmarkDivergences({
      benchmarkCase,
      canonical: canonicalSnapshot,
      brain: brainOnlySnapshot,
      canonicalScore,
      brainScore: brainOnlyScore,
    });
    const hybridDivergences = classifyBenchmarkDivergences({
      benchmarkCase,
      canonical: canonicalSnapshot,
      brain: hybridSnapshot,
      canonicalScore,
      brainScore: hybridScore,
    });

    return deepFreeze({
      caseId: publicInput.caseId,
      canonicalSnapshot,
      brainOnlySnapshot,
      hybridSnapshot,
      canonicalScore,
      brainOnlyScore,
      hybridScore,
      brainOnlyDelta: round(brainOnlyScore.overall - canonicalScore.overall),
      hybridDelta: round(hybridScore.overall - canonicalScore.overall),
      brainOnlyIncrementalValue: brainHasIncrementalValue(brainOnlyDivergences),
      hybridIncrementalValue: brainHasIncrementalValue(hybridDivergences),
      winner: classifyWinner(canonicalScore.overall, brainOnlyScore.overall, hybridScore.overall),
      brainOnlyDivergences,
      hybridDivergences,
    });
  });

  const brainOnlyDivergenceCounts = emptyDivergenceCounts();
  const hybridDivergenceCounts = emptyDivergenceCounts();
  for (const result of perCase) {
    for (const divergence of result.brainOnlyDivergences)
      brainOnlyDivergenceCounts[divergence.type] += 1;
    for (const divergence of result.hybridDivergences) hybridDivergenceCounts[divergence.type] += 1;
  }

  return deepFreeze({
    codeSha: options.codeSha ?? "UNKNOWN",
    benchmarkVersion: canonicalShadowBenchmarkVersion,
    caseCount: perCase.length,
    canonicalAverageScore: average(perCase.map((item) => item.canonicalScore.overall)),
    brainOnlyAverageScore: average(perCase.map((item) => item.brainOnlyScore.overall)),
    hybridAverageScore: average(perCase.map((item) => item.hybridScore.overall)),
    brainOnlyUsefulAdditionRate: average(
      perCase.map((item) => (item.brainOnlyIncrementalValue ? 1 : 0)),
    ),
    hybridUsefulAdditionRate: average(perCase.map((item) => (item.hybridIncrementalValue ? 1 : 0))),
    brainOnlyFalsePositiveRate: average(
      perCase.map((item) => (item.brainOnlyScore.falsePositiveCount > 0 ? 1 : 0)),
    ),
    hybridFalsePositiveRate: average(
      perCase.map((item) => (item.hybridScore.falsePositiveCount > 0 ? 1 : 0)),
    ),
    brainOnlyCriticalHallucinations: perCase.reduce(
      (sum, item) => sum + item.brainOnlyScore.criticalFalsePositiveCount,
      0,
    ),
    hybridCriticalHallucinations: perCase.reduce(
      (sum, item) => sum + item.hybridScore.criticalFalsePositiveCount,
      0,
    ),
    brainOnlyUnsupportedRoiClaims: perCase.reduce(
      (sum, item) => sum + item.brainOnlyScore.unsupportedRoiClaimCount,
      0,
    ),
    hybridUnsupportedRoiClaims: perCase.reduce(
      (sum, item) => sum + item.hybridScore.unsupportedRoiClaimCount,
      0,
    ),
    brainOnlyDivergenceCounts,
    hybridDivergenceCounts,
    perCase,
    promotionEligible: false,
    promotionRationale:
      "MVP benchmark has only five labeled cases; results are diagnostic and cannot promote Brain ownership.",
  });
}

export function createCanonicalBenchmarkSnapshot(
  publicInput: BenchmarkPublicInput,
): CanonicalBenchmarkSnapshot {
  const evidenceRefs = publicInput.evidence.map((item) => item.id);
  const findings = detectConcepts(publicInput, "finding")
    .slice(0, 3)
    .map((conceptId, index) =>
      claim(
        `canonical:${publicInput.caseId}:finding:${index + 1}`,
        summarizeConcept(publicInput, conceptId),
        [conceptId],
        evidenceRefs,
        0.78,
      ),
    );
  const opportunities = detectConcepts(publicInput, "opportunity")
    .slice(0, 2)
    .map((conceptId, index) =>
      opportunityLike({
        id: `canonical:${publicInput.caseId}:opportunity:${index + 1}`,
        title: opportunityTitle(conceptId),
        conceptIds: [conceptId],
        evidenceRefs,
        priorityRank: index + 1,
        decision: needsMoreEvidence(publicInput, conceptId) ? "NEED_MORE_EVIDENCE" : "RECOMMEND",
        confidence: 0.74,
      }),
    );
  const recommendations = opportunities.filter((item) => item.decision === "RECOMMEND");
  return deepFreeze({
    caseId: publicInput.caseId,
    knowledgeFacts: publicInput.evidence.map((item, index) =>
      claim(
        `canonical:${publicInput.caseId}:knowledge:${index + 1}`,
        item.statement,
        [],
        [item.id],
        item.reliability,
      ),
    ),
    processStructure: publicInput.workflow,
    businessFindings: findings,
    aiOpportunities: opportunities,
    automationOpportunities: opportunities,
    roi: inferRoi(publicInput, 0.7),
    recommendations,
    blueprintSummary: implementationSummary(recommendations, publicInput.constraints, evidenceRefs),
    specificationSummary: implementationSummary(
      recommendations,
      publicInput.constraints,
      evidenceRefs,
    ),
    executiveResult: {
      status: recommendations.length > 0 ? "READY" : "UNAVAILABLE",
      complete: recommendations.length > 0,
      priorityCards: recommendations.map((item) => item.title),
      evidenceRefs,
    },
  });
}

export function createBrainOnlyShadowSnapshot(
  publicInput: BenchmarkPublicInput,
): BrainShadowBenchmarkSnapshot {
  const evidence = toBrainEvidence(publicInput);
  const evidenceRefs = evidence.map((item) => item.evidenceId);
  const confidenceModel = new DeterministicConfidenceModel();
  const claims = evidence.map((item, index) => {
    const confidence = confidenceModel.calculate({
      supportingEvidenceCount: 1,
      averageSourceReliability: item.reliability,
      sourceAgreement: 0.75,
      freshness: item.freshness === "STALE" ? 0.45 : 0.9,
      directness: 0.78,
      contradictionPenalty: hasUncertainty(publicInput) ? 0.12 : 0,
      missingDataPenalty: hasIncompleteEconomics(publicInput) ? 0.25 : 0,
    });
    return Claim.create({
      claimId: `brain:${publicInput.caseId}:claim:${index + 1}`,
      kind: "INFERENCE",
      statement: item.content,
      supportingEvidenceIds: [item.evidenceId],
      confidence,
      rationale: "Brain-only shadow claim derived from public business text.",
      createdByModule: "brain_evaluation",
      createdAt: fixedBenchmarkDate,
      lastEvaluatedAt: fixedBenchmarkDate,
    });
  });
  const detectedFindings = detectConcepts(publicInput, "finding");
  const detectedRootCauses = detectConcepts(publicInput, "rootCause");
  const detectedBottlenecks = detectConcepts(publicInput, "bottleneck");
  const detectedOpportunities = detectConcepts(publicInput, "opportunity");
  return deepFreeze({
    caseId: publicInput.caseId,
    claims: [
      ...claims.map((item) =>
        claim(
          item.claimId,
          item.statement,
          conceptsForText(publicInput, item.statement, "finding"),
          item.supportingEvidenceIds,
          item.confidence.value,
        ),
      ),
      ...detectedFindings.map((conceptId, index) =>
        claim(
          `brain:${publicInput.caseId}:finding:${index + 1}`,
          summarizeConcept(publicInput, conceptId),
          [conceptId],
          evidenceRefs,
          0.78,
        ),
      ),
    ],
    evidenceRefs,
    unknowns: inferUnknowns(publicInput),
    contradictions: inferContradictions(publicInput),
    rootCauses: detectedRootCauses.map((conceptId, index) =>
      claim(
        `brain:${publicInput.caseId}:root:${index + 1}`,
        summarizeConcept(publicInput, conceptId),
        [conceptId],
        evidenceRefs,
        0.72,
      ),
    ),
    bottlenecks: detectedBottlenecks.map((conceptId, index) =>
      claim(
        `brain:${publicInput.caseId}:bottleneck:${index + 1}`,
        summarizeConcept(publicInput, conceptId),
        [conceptId],
        evidenceRefs,
        0.72,
      ),
    ),
    opportunityDecisions: detectedOpportunities.map((conceptId, index) =>
      opportunityLike({
        id: `brain:${publicInput.caseId}:opportunity:${index + 1}`,
        title: opportunityTitle(conceptId),
        conceptIds: [conceptId],
        evidenceRefs,
        priorityRank: index + 1,
        decision: needsMoreEvidence(publicInput, conceptId) ? "NEED_MORE_EVIDENCE" : "RECOMMEND",
        confidence: 0.76,
      }),
    ),
    priorities: detectedOpportunities,
    economicAssessment: inferRoi(publicInput, hasIncompleteEconomics(publicInput) ? 0.52 : 0.76),
    critiques: detectConcepts(publicInput, "risk").map((conceptId) =>
      summarizeConcept(publicInput, conceptId),
    ),
    confidence: round(average(claims.map((item) => item.confidence.value))),
  });
}

export function createHybridShadowSnapshot(
  publicInput: BenchmarkPublicInput,
  canonicalSnapshot: CanonicalBenchmarkSnapshot,
): BrainShadowBenchmarkSnapshot {
  const canonicalConcepts = new Set([
    ...canonicalSnapshot.businessFindings.flatMap((item) => item.conceptIds),
    ...canonicalSnapshot.recommendations.flatMap((item) => item.conceptIds),
  ]);
  const brainOnly = createBrainOnlyShadowSnapshot(publicInput);
  const additions = [
    ...brainOnly.claims,
    ...brainOnly.rootCauses,
    ...brainOnly.bottlenecks,
    ...brainOnly.opportunityDecisions,
  ].filter((item) => !item.conceptIds.some((conceptId) => canonicalConcepts.has(conceptId)));
  const hybridContributions: HybridContribution[] = [
    ...canonicalSnapshot.businessFindings.map((item) => ({
      kind: "CANONICAL_BASE" as const,
      statement: item.statement,
      conceptIds: item.conceptIds,
      evidenceRefs: item.evidenceRefs,
    })),
    ...brainOnly.claims
      .filter((item) => item.conceptIds.some((conceptId) => canonicalConcepts.has(conceptId)))
      .map((item) => ({
        kind: "BRAIN_CONFIRMATION" as const,
        statement: item.statement,
        conceptIds: item.conceptIds,
        evidenceRefs: item.evidenceRefs,
      })),
    ...additions.map((item) => ({
      kind: "BRAIN_ADDITION" as const,
      statement: "title" in item ? item.title : item.statement,
      conceptIds: item.conceptIds,
      evidenceRefs: item.evidenceRefs,
    })),
    ...brainOnly.unknowns.map((unknown) => ({
      kind: "NEEDS_MORE_EVIDENCE" as const,
      statement: unknown,
      conceptIds: [],
      evidenceRefs: brainOnly.evidenceRefs,
    })),
  ];
  return deepFreeze({
    ...brainOnly,
    claims: uniqueClaims([...canonicalSnapshot.businessFindings, ...brainOnly.claims]),
    opportunityDecisions: uniqueOpportunities([
      ...canonicalSnapshot.recommendations,
      ...brainOnly.opportunityDecisions,
    ]),
    priorities: unique([
      ...canonicalSnapshot.recommendations.map((item) => item.conceptIds[0] ?? item.id),
      ...brainOnly.priorities,
    ]),
    economicAssessment: brainOnly.economicAssessment,
    critiques: unique([...brainOnly.critiques, ...canonicalSnapshot.blueprintSummary.controls]),
    hybridContributions,
  });
}

function detectConcepts(
  publicInput: BenchmarkPublicInput,
  kind: (typeof conceptRules)[number]["kind"],
): readonly string[] {
  const text = publicText(publicInput);
  return unique(
    conceptRules
      .filter((item) => item.kind === kind && item.phrases.some((phrase) => includes(text, phrase)))
      .map((item) => item.conceptId),
  );
}

function conceptsForText(
  publicInput: BenchmarkPublicInput,
  text: string,
  kind: (typeof conceptRules)[number]["kind"],
): readonly string[] {
  const scoped = publicText({
    ...publicInput,
    evidence: [{ id: "local", source: "local", statement: text, reliability: 1 }],
  });
  return unique(
    conceptRules
      .filter(
        (item) => item.kind === kind && item.phrases.some((phrase) => includes(scoped, phrase)),
      )
      .map((item) => item.conceptId),
  );
}

function toBrainEvidence(publicInput: BenchmarkPublicInput): readonly Evidence[] {
  return publicInput.evidence.map((item) =>
    Evidence.create({
      evidenceId: item.id,
      sourceType: item.source.toLowerCase().includes("interview") ? "INTERVIEW" : "DOCUMENT",
      sourceReference: item.source,
      sourceModule: "brain_evaluation",
      capturedAt: fixedBenchmarkDate,
      freshness: item.statement.toLowerCase().includes("out of date") ? "STALE" : "CURRENT",
      reliability: item.reliability,
      content: item.statement,
      provenance: { benchmarkCaseId: publicInput.caseId, hiddenTruthIncluded: false },
    }),
  );
}

function inferRoi(publicInput: BenchmarkPublicInput, confidence: number) {
  if (hasIncompleteEconomics(publicInput)) {
    return {
      direction: "INSUFFICIENT_EVIDENCE" as RoiDirection,
      confidence,
      evidenceRefs: evidenceWithNumbers(publicInput),
      numericClaims: [],
      missingInputs: ["verified conversion attribution", "validated financial impact"],
    };
  }
  const numericClaims = publicInput.evidence
    .filter((item) => /\d/.test(item.statement))
    .map((item) => item.statement);
  const direction =
    numericClaims.length > 0 && !hasHighControlOnlyValue(publicInput) ? "POSITIVE" : "NEUTRAL";
  return {
    direction: direction as RoiDirection,
    confidence,
    evidenceRefs: evidenceWithNumbers(publicInput),
    numericClaims,
    missingInputs: direction === "POSITIVE" ? [] : ["validated recurring savings"],
  };
}

function implementationSummary(
  recommendations: readonly BenchmarkOpportunityLike[],
  controls: readonly string[],
  evidenceRefs: readonly string[],
) {
  return {
    status: recommendations.length > 0 ? ("READY" as const) : ("INCOMPLETE" as const),
    selectedPatterns: recommendations.map((item) => item.title),
    controls,
    evidenceRefs,
  };
}

function classifyWinner(
  canonicalScore: number,
  brainOnlyScore: number,
  hybridScore: number,
): BenchmarkWinner {
  const scores = [
    ["CANONICAL_WINS", canonicalScore],
    ["BRAIN_ONLY_WINS", brainOnlyScore],
    ["HYBRID_WINS", hybridScore],
  ] as const;
  const sorted = [...scores].sort((left, right) => right[1] - left[1]);
  if ((sorted[0]?.[1] ?? 0) < 50) return "INSUFFICIENT_EVIDENCE";
  if ((sorted[0]?.[1] ?? 0) - (sorted[1]?.[1] ?? 0) < 3) return "NO_MEANINGFUL_DIFFERENCE";
  return sorted[0]![0];
}

function summarizeConcept(publicInput: BenchmarkPublicInput, conceptId: string): string {
  const text = [
    ...publicInput.painPoints,
    ...publicInput.risks,
    ...publicInput.constraints,
    ...publicInput.evidence.map((item) => item.statement),
  ].find((item) =>
    conceptRules.some(
      (ruleItem) =>
        ruleItem.conceptId === conceptId &&
        ruleItem.phrases.some((phrase) => includes(item, phrase)),
    ),
  );
  return text ?? label(conceptId);
}

function opportunityTitle(conceptId: string): string {
  return `Address ${label(conceptId)}`;
}

function inferUnknowns(publicInput: BenchmarkPublicInput): readonly string[] {
  const text = publicText(publicInput);
  const unknowns: string[] = [];
  if (includes(text, "incomplete"))
    unknowns.push("Evidence describes incomplete attribution or input data.");
  if (includes(text, "varies"))
    unknowns.push("Evidence describes variable freshness that should be verified.");
  if (includes(text, "outside automation scope"))
    unknowns.push("Sensitive or judgmental work remains outside scope.");
  return Object.freeze(unknowns);
}

function inferContradictions(publicInput: BenchmarkPublicInput): readonly string[] {
  const text = publicText(publicInput);
  if (includes(text, "out of date"))
    return Object.freeze(["Current decisions may rely on stale operational data."]);
  if (includes(text, "must still be reviewed") || includes(text, "human review")) {
    return Object.freeze(["Automation opportunity is bounded by mandatory human review evidence."]);
  }
  return Object.freeze([]);
}

function needsMoreEvidence(publicInput: BenchmarkPublicInput, conceptId: string): boolean {
  return conceptId.includes("routing") && hasIncompleteEconomics(publicInput);
}

function hasIncompleteEconomics(publicInput: BenchmarkPublicInput): boolean {
  return includes(publicText(publicInput), "attribution is incomplete");
}

function hasUncertainty(publicInput: BenchmarkPublicInput): boolean {
  return (
    includes(publicText(publicInput), "incomplete") || includes(publicText(publicInput), "varies")
  );
}

function hasHighControlOnlyValue(publicInput: BenchmarkPublicInput): boolean {
  return (
    includes(publicText(publicInput), "salary") || includes(publicText(publicInput), "medical")
  );
}

function evidenceWithNumbers(publicInput: BenchmarkPublicInput): readonly string[] {
  return publicInput.evidence.filter((item) => /\d/.test(item.statement)).map((item) => item.id);
}

function publicText(publicInput: BenchmarkPublicInput): string {
  return [
    publicInput.title,
    publicInput.companyContext,
    publicInput.process,
    ...publicInput.roles,
    ...publicInput.tools,
    ...publicInput.workflow,
    ...Object.values(publicInput.volumes).map(String),
    ...Object.values(publicInput.durations).map(String),
    ...publicInput.manualWork,
    ...publicInput.painPoints,
    ...publicInput.risks,
    ...publicInput.constraints,
    ...publicInput.evidence.map((item) => `${item.source} ${item.statement}`),
  ].join(" ");
}

function rule(
  conceptId: string,
  kind: (typeof conceptRules)[number]["kind"],
  phrases: readonly string[],
) {
  return Object.freeze({ conceptId, kind, phrases });
}

function includes(text: string, phrase: string): boolean {
  return normalize(text).includes(normalize(phrase));
}

function claim(
  id: string,
  statement: string,
  conceptIds: readonly string[],
  evidenceRefs: readonly string[],
  confidence: number,
): BenchmarkClaimLike {
  return Object.freeze({
    id,
    statement,
    conceptIds: Object.freeze([...conceptIds]),
    evidenceRefs: Object.freeze([...evidenceRefs]),
    confidence: round(confidence),
  });
}

function opportunityLike(input: {
  readonly id: string;
  readonly title: string;
  readonly conceptIds: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly priorityRank: number;
  readonly decision: BenchmarkOpportunityLike["decision"];
  readonly confidence: number;
}): BenchmarkOpportunityLike {
  return Object.freeze({
    id: input.id,
    title: input.title,
    conceptIds: Object.freeze([...input.conceptIds]),
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    priorityRank: input.priorityRank,
    decision: input.decision,
    confidence: round(input.confidence),
  });
}

function uniqueClaims(claims: readonly BenchmarkClaimLike[]): readonly BenchmarkClaimLike[] {
  const seen = new Set<string>();
  return claims.filter((item) => {
    const key = item.conceptIds.join("|") || item.statement;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueOpportunities(
  opportunities: readonly BenchmarkOpportunityLike[],
): readonly BenchmarkOpportunityLike[] {
  const seen = new Set<string>();
  return opportunities.filter((item) => {
    const key = item.conceptIds.join("|") || item.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function emptyDivergenceCounts(): Record<BenchmarkDivergenceType, number> {
  return {
    AGREE: 0,
    BRAIN_ADDS_VALUE: 0,
    CANONICAL_BETTER: 0,
    BRAIN_FALSE_POSITIVE: 0,
    CANONICAL_MISSED_ITEM: 0,
    PRIORITY_DISAGREEMENT: 0,
    ROI_DISAGREEMENT: 0,
    INSUFFICIENT_EVIDENCE: 0,
  };
}

function clonePublicInput(publicInput: BenchmarkPublicInput): BenchmarkPublicInput {
  return JSON.parse(JSON.stringify(publicInput)) as BenchmarkPublicInput;
}

function unique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}

function label(value: string): string {
  return value.replaceAll("_", " ");
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
