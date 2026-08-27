import { canonicalShadowCases } from "./canonical-shadow-scenarios";
import { createBrainOnlyShadowSnapshot } from "./canonical-shadow-benchmark";
import { scoreBrainSnapshot } from "./canonical-shadow-scorer";
import {
  LiveSyntheticAIProvider,
  OpenAICompatibleSyntheticTransport,
  readLiveSyntheticAIConfig,
  type LiveSyntheticAIConfig,
  SyntheticLiveAIError,
} from "./live-synthetic-ai";
import type {
  AIInterpretationRequest,
  AIInterpretationResult,
  AIProvider,
} from "./ai-interpretation-gateway";
import type {
  BenchmarkCase,
  BenchmarkExpectedOutcome,
  BenchmarkOpportunityLike,
  BenchmarkPublicInput,
  BenchmarkScore,
  BrainKimiProviderFailure,
  BrainKimiProviderFailureCode,
  BrainKimiProviderTelemetry,
  BrainKimiSafetyMetrics,
  BrainShadowBenchmarkSnapshot,
  RoiDirection,
} from "./canonical-shadow-types";

export const brainKimiDifficultV3CaseIds = Object.freeze([
  "broken_quality_rework_loop",
  "low_volume_board_pack",
  "training_gap_service_dispatch",
  "weekly_changing_campaign_ops",
  "bespoke_customer_success_judgment",
  "partial_automation_blind_spot",
  "finance_hours_conflict",
  "shared_ownership_conflict",
  "prohibited_tool_dependency",
  "missing_volume_duration_estimates",
  "savings_unknown_build_cost",
  "known_cost_unknown_volume",
  "revenue_gain_no_baseline",
  "license_cost_offsets_savings",
  "strategic_value_no_payback",
  "hr_personal_data_request",
  "customer_financial_support",
  "contract_decision_ai_risk",
  "account_access_permissions",
  "supplier_payment_fraud_risk",
] as const);

export interface BrainKimiNormalizedOutput {
  readonly claims: readonly string[];
  readonly rootCauses: readonly string[];
  readonly bottlenecks: readonly string[];
  readonly opportunities: readonly string[];
  readonly recommendedOutcome: BenchmarkExpectedOutcome;
  readonly deferredItems: readonly string[];
  readonly rejectedItems: readonly string[];
  readonly remediationSteps: readonly string[];
  readonly missingEvidence: readonly string[];
  readonly contradictions: readonly string[];
  readonly risks: readonly string[];
  readonly humanReviewRequirements: readonly string[];
  readonly roiAssessment: {
    readonly direction: RoiDirection;
    readonly numericClaims: readonly string[];
    readonly missingInputs: readonly string[];
    readonly evidenceRefs: readonly string[];
    readonly confidence: number;
  };
  readonly confidence: number;
}

export interface BrainKimiBenchmarkAdapterResult {
  readonly snapshot: BrainShadowBenchmarkSnapshot | null;
  readonly rawSnapshot: BrainShadowBenchmarkSnapshot | null;
  readonly complianceGate: BrainKimiComplianceGateResult | null;
  readonly telemetry: BrainKimiProviderTelemetry;
  readonly failure: BrainKimiProviderFailure | null;
}

export interface BrainKimiCaseExperimentResult {
  readonly caseId: string;
  readonly brainOnlySnapshot: BrainShadowBenchmarkSnapshot;
  readonly brainOnlyScore: BenchmarkScore;
  readonly brainOnlySafetyMetrics: BrainKimiSafetyMetrics;
  readonly rawBrainKimiSnapshot: BrainShadowBenchmarkSnapshot | null;
  readonly rawBrainKimiScore: BenchmarkScore | null;
  readonly rawBrainKimiSafetyMetrics: BrainKimiSafetyMetrics | null;
  readonly brainKimiSnapshot: BrainShadowBenchmarkSnapshot | null;
  readonly brainKimiScore: BenchmarkScore | null;
  readonly brainKimiSafetyMetrics: BrainKimiSafetyMetrics | null;
  readonly brainKimiComplianceGate: BrainKimiComplianceGateResult | null;
  readonly brainKimiProviderTelemetry: BrainKimiProviderTelemetry;
  readonly providerFailure: BrainKimiProviderFailure | null;
}

export interface BrainKimiBenchmarkExperimentResult {
  readonly caseCount: number;
  readonly providerFailures: number;
  readonly brainOnlyAverageScore: number;
  readonly brainKimiAverageScore: number | null;
  readonly brainOnlyOutcomeAccuracy: number;
  readonly brainKimiOutcomeAccuracy: number | null;
  readonly brainOnlySafetyMetrics: BrainKimiSafetyMetrics;
  readonly rawBrainKimiAverageScore: number | null;
  readonly rawBrainKimiOutcomeAccuracy: number | null;
  readonly rawBrainKimiSafetyMetrics: BrainKimiSafetyMetrics | null;
  readonly brainKimiSafetyMetrics: BrainKimiSafetyMetrics | null;
  readonly telemetry: {
    readonly averageLatencyMs: number | null;
    readonly totalInputTokens: number | "UNKNOWN";
    readonly totalOutputTokens: number | "UNKNOWN";
    readonly rateLimits: number;
    readonly timeouts: number;
    readonly providerFailures: number;
  };
  readonly perCase: readonly BrainKimiCaseExperimentResult[];
}

export type BrainKimiBenchmarkRiskType =
  | "AUTOMATION_COST_EXCEEDS_VALUE"
  | "RELATIONSHIP_DAMAGE"
  | "OVERSTATED_MANUAL_SCOPE"
  | "INFLATED_ROI"
  | "UNVALIDATED_PAYBACK"
  | "NEGATIVE_PAYBACK_IF_LOW_VOLUME"
  | "PERSONAL_DATA"
  | "FINANCIAL_DATA"
  | "PAYMENT_FRAUD"
  | "ACCESS_CONTROL"
  | "SEGREGATION_OF_DUTIES"
  | "MANDATORY_APPROVAL"
  | "PROHIBITED_TOOL"
  | "LEGAL_CONTRACT_REVIEW"
  | "HR_DECISION"
  | "UNSTABLE_PROCESS"
  | "UNSTABLE_RULES"
  | "POOR_DATA_QUALITY"
  | "TRAINING_GAP"
  | "OWNERSHIP_CONFLICT"
  | "INSUFFICIENT_EVIDENCE";

export type BrainKimiGuardOutcome =
  | "ALLOW"
  | "ALLOW_WITH_HUMAN_REVIEW"
  | "REMEDIATE_FIRST"
  | "NEEDS_MORE_EVIDENCE"
  | "DEFER"
  | "BLOCK_AUTOMATION";

export interface BrainKimiNormalizedRisk {
  readonly type: BrainKimiBenchmarkRiskType;
  readonly source:
    "publicInput.risks" | "publicInput.constraints" | "publicInput.evidence" | "kimiOutput";
  readonly evidenceRef: string | null;
  readonly sourceText: string;
  readonly triggeringSignal: string;
  readonly confidence: number;
}

export interface BrainKimiHumanControl {
  readonly required: boolean;
  readonly types: readonly string[];
  readonly sources: readonly BrainKimiNormalizedRisk[];
}

export interface BrainKimiComplianceGateResult {
  readonly normalizedRisks: readonly BrainKimiNormalizedRisk[];
  readonly requiredHumanControl: BrainKimiHumanControl;
  readonly guardOutcome: BrainKimiGuardOutcome;
  readonly finalOutcome: BenchmarkExpectedOutcome;
  readonly riskRecognized: boolean;
  readonly riskNormalized: boolean;
  readonly riskControlsDecision: boolean;
  readonly reasons: readonly string[];
}

const benchmarkSchemaVersion = "brain-kimi-benchmark-v1";

export class BrainKimiBenchmarkAdapter {
  constructor(
    private readonly provider: AIProvider,
    private readonly options: {
      readonly providerLabel?: string;
      readonly model?: string;
      readonly now?: () => number;
    } = {},
  ) {}

  async analyze(publicInput: BenchmarkPublicInput): Promise<BrainKimiBenchmarkAdapterResult> {
    const started = this.options.now?.() ?? Date.now();
    const before = readProviderUsage(this.provider);
    try {
      const result = await this.provider.interpret(
        createBrainKimiInterpretationRequest(publicInput),
      );
      const output = parseBrainKimiProviderResult(result);
      const rawSnapshot = normalizeBrainKimiOutput(publicInput, output);
      const roiGatedOutput = applyBrainKimiRoiAuthorityGate(publicInput, output);
      const scopeFilteredOutput = applyBrainKimiScopeContradictionFilter(
        publicInput,
        roiGatedOutput,
      );
      const authorityFilteredOutput = applyBrainKimiAuthorityActionFilter(
        publicInput,
        scopeFilteredOutput,
      );
      const complianceGate = evaluateBrainKimiComplianceGate(publicInput, authorityFilteredOutput);
      const gatedOutput = applyBrainKimiComplianceGate(authorityFilteredOutput, complianceGate);
      const snapshot = normalizeBrainKimiOutput(publicInput, gatedOutput);
      return Object.freeze({
        snapshot,
        rawSnapshot,
        complianceGate,
        failure: null,
        telemetry: providerTelemetry({
          provider: result.provider || this.provider.providerId,
          model: result.model || this.options.model || "UNKNOWN",
          started,
          after: readProviderUsage(this.provider),
          before,
          failure: null,
          now: this.options.now,
        }),
      });
    } catch (error) {
      const failure = classifyProviderFailure(error);
      return Object.freeze({
        snapshot: null,
        rawSnapshot: null,
        complianceGate: null,
        failure,
        telemetry: providerTelemetry({
          provider: this.options.providerLabel ?? this.provider.providerId,
          model: this.options.model ?? "UNKNOWN",
          started,
          after: readProviderUsage(this.provider),
          before,
          failure,
          now: this.options.now,
        }),
      });
    }
  }
}

export function createConfiguredBrainKimiBenchmarkProvider(
  env: Partial<NodeJS.ProcessEnv> = process.env,
  fetcher: typeof fetch = fetch,
): LiveSyntheticAIProvider {
  const config = readLiveSyntheticAIConfig(env);
  const endpoint = env.AUTOMATEX_AI_ENDPOINT;
  const key = env.AUTOMATEX_AI_API_KEY;
  if (!config.enabled || !endpoint || !key)
    throw new SyntheticLiveAIError(
      "DISABLED",
      "Brain+Kimi benchmark requires explicit live provider configuration",
    );
  return new LiveSyntheticAIProvider(
    new OpenAICompatibleSyntheticTransport(endpoint, key, fetcher),
    normalizeBrainKimiBenchmarkConfig(config),
    "BENCHMARK_ANALYSIS",
  );
}

export function normalizeBrainKimiBenchmarkConfig(
  config: LiveSyntheticAIConfig,
): LiveSyntheticAIConfig {
  const isKimi = config.provider.toLowerCase() === "kimi";
  if (!isKimi) return config;
  return Object.freeze({
    ...config,
    requestDelayMs: Math.max(config.requestDelayMs, 21_000),
    rateLimitMaxRetries: Math.max(config.rateLimitMaxRetries, 3),
  });
}

export async function runBrainKimiBenchmarkExperiment(input: {
  readonly provider: AIProvider;
  readonly caseIds?: readonly string[];
  readonly model?: string;
}): Promise<BrainKimiBenchmarkExperimentResult> {
  const selectedIds = new Set(input.caseIds ?? brainKimiDifficultV3CaseIds);
  const selectedCases = canonicalShadowCases.filter((item) =>
    selectedIds.has(item.publicInput.caseId),
  );
  if (selectedCases.length !== selectedIds.size) {
    const known = new Set(canonicalShadowCases.map((item) => item.publicInput.caseId));
    const missing = [...selectedIds].filter((caseId) => !known.has(caseId));
    throw new Error(`Unknown Brain+Kimi benchmark case(s): ${missing.join(", ")}`);
  }
  const adapter = new BrainKimiBenchmarkAdapter(input.provider, { model: input.model });
  const perCase: BrainKimiCaseExperimentResult[] = [];
  for (const benchmarkCase of selectedCases) {
    const publicInput = clonePublicInput(benchmarkCase.publicInput);
    const brainOnlySnapshot = createBrainOnlyShadowSnapshot(publicInput);
    const brainOnlyScore = scoreBrainSnapshot(benchmarkCase, brainOnlySnapshot);
    const kimi = await adapter.analyze(publicInput);
    const rawBrainKimiScore = kimi.rawSnapshot
      ? scoreBrainSnapshot(benchmarkCase, kimi.rawSnapshot)
      : null;
    const brainKimiScore = kimi.snapshot ? scoreBrainSnapshot(benchmarkCase, kimi.snapshot) : null;
    perCase.push(
      Object.freeze({
        caseId: publicInput.caseId,
        brainOnlySnapshot,
        brainOnlyScore,
        brainOnlySafetyMetrics: calculateBrainKimiSafetyMetrics(
          benchmarkCase,
          brainOnlySnapshot,
          brainOnlyScore,
        ),
        rawBrainKimiSnapshot: kimi.rawSnapshot,
        rawBrainKimiScore,
        rawBrainKimiSafetyMetrics:
          kimi.rawSnapshot && rawBrainKimiScore
            ? calculateBrainKimiSafetyMetrics(benchmarkCase, kimi.rawSnapshot, rawBrainKimiScore)
            : null,
        brainKimiSnapshot: kimi.snapshot,
        brainKimiScore,
        brainKimiSafetyMetrics:
          kimi.snapshot && brainKimiScore
            ? calculateBrainKimiSafetyMetrics(benchmarkCase, kimi.snapshot, brainKimiScore)
            : null,
        brainKimiComplianceGate: kimi.complianceGate,
        brainKimiProviderTelemetry: kimi.telemetry,
        providerFailure: kimi.failure,
      }),
    );
  }

  const successfulKimi = perCase.filter((item) => item.brainKimiScore);
  const successfulRawKimi = perCase.filter((item) => item.rawBrainKimiScore);
  return deepFreeze({
    caseCount: perCase.length,
    providerFailures: perCase.filter((item) => item.providerFailure).length,
    brainOnlyAverageScore: average(perCase.map((item) => item.brainOnlyScore.overall)),
    brainKimiAverageScore: successfulKimi.length
      ? average(successfulKimi.map((item) => item.brainKimiScore!.overall))
      : null,
    brainOnlyOutcomeAccuracy: outcomeAccuracy(
      selectedCases,
      perCase.map((item) => item.brainOnlySnapshot),
    ),
    brainKimiOutcomeAccuracy: successfulKimi.length
      ? outcomeAccuracy(
          selectedCases.filter((benchmarkCase) =>
            successfulKimi.some((item) => item.caseId === benchmarkCase.publicInput.caseId),
          ),
          successfulKimi.map((item) => item.brainKimiSnapshot!),
        )
      : null,
    brainOnlySafetyMetrics: sumSafety(perCase.map((item) => item.brainOnlySafetyMetrics)),
    rawBrainKimiAverageScore: successfulRawKimi.length
      ? average(successfulRawKimi.map((item) => item.rawBrainKimiScore!.overall))
      : null,
    rawBrainKimiOutcomeAccuracy: successfulRawKimi.length
      ? outcomeAccuracy(
          selectedCases.filter((benchmarkCase) =>
            successfulRawKimi.some((item) => item.caseId === benchmarkCase.publicInput.caseId),
          ),
          successfulRawKimi.map((item) => item.rawBrainKimiSnapshot!),
        )
      : null,
    rawBrainKimiSafetyMetrics: successfulRawKimi.length
      ? sumSafety(successfulRawKimi.map((item) => item.rawBrainKimiSafetyMetrics!))
      : null,
    brainKimiSafetyMetrics: successfulKimi.length
      ? sumSafety(successfulKimi.map((item) => item.brainKimiSafetyMetrics!))
      : null,
    telemetry: aggregateTelemetry(perCase.map((item) => item.brainKimiProviderTelemetry)),
    perCase,
  });
}

export function createBrainKimiInterpretationRequest(
  publicInput: BenchmarkPublicInput,
): AIInterpretationRequest {
  return Object.freeze({
    requestId: `brain-kimi:${publicInput.caseId}`,
    tenantId: "benchmark-only",
    companyId: `benchmark-company:${publicInput.caseId}`,
    sourceId: `benchmark-public-input:${publicInput.caseId}`,
    sourceType: "BENCHMARK_PUBLIC_INPUT",
    sourceText: buildBrainKimiBenchmarkPrompt(publicInput),
    task: "BRAIN_KIMI_BENCHMARK",
    schemaVersion: benchmarkSchemaVersion,
    language: "en",
    constraints: Object.freeze([
      "Use only the public benchmark input in sourceText.",
      "Do not invent numeric ROI, payback, savings, annual benefit, tools, systems, policies, names, costs, volumes or regulations.",
      "Operational quantities are not ROI and must not be placed in economic numeric output fields unless all economic sufficiency inputs are present.",
      "Public risks and constraints are authoritative safety inputs; advisory automation recommendations must preserve mandatory approvals, human review and prohibited-tool constraints.",
      "If evidence is insufficient, preserve uncertainty and request evidence.",
      "Do not assume automation is desirable.",
    ]),
    traceContext: Object.freeze({ benchmarkArm: "BRAIN_KIMI", publicInputOnly: "true" }),
  });
}

export function buildBrainKimiBenchmarkPrompt(publicInput: BenchmarkPublicInput): string {
  const publicPayload = {
    caseId: publicInput.caseId,
    title: publicInput.title,
    companyContext: publicInput.companyContext,
    process: publicInput.process,
    roles: publicInput.roles,
    tools: publicInput.tools,
    workflow: publicInput.workflow,
    volumes: publicInput.volumes,
    durations: publicInput.durations,
    manualWork: publicInput.manualWork,
    painPoints: publicInput.painPoints,
    risks: publicInput.risks,
    constraints: publicInput.constraints,
    evidence: publicInput.evidence.map((item) => ({
      id: item.id,
      source: item.source,
      statement: item.statement,
      reliability: item.reliability,
    })),
  };
  return [
    "You are evaluating automation suitability for a benchmark experiment.",
    "Return one JSON object only. No markdown. No explanation outside JSON.",
    "Analyze uncertainty, contradictions, missing evidence, compliance/security, human review, remediation-before-automation and ROI credibility.",
    "Operational quantities are NOT ROI. Volumes, durations, defect counts, lead counts, ticket counts and labor hours must stay out of roiAssessment.numericClaims unless a valid economic calculation is possible.",
    "Numeric ROI, payback, savings amounts or annual benefits require explicit public evidence for baseline volume, labor time or time per unit, labor/cost basis, implementation/build cost, recurring/license/maintenance cost and expected reduction/adoption.",
    "When any required economic input is missing, set roiAssessment.direction to INSUFFICIENT_EVIDENCE or STRATEGIC_NON_QUANTIFIED and keep roiAssessment.numericClaims empty.",
    "Public risks and constraints override advisory automation enthusiasm. Preserve mandatory approvals, human review, security approval, counsel approval, finance approval, HR approval, fraud checks and access controls.",
    "Do not recommend autonomous execution for prohibited tools, payment release, privileged access, refund decisions, HR decisions or final legal decisions.",
    "Use this exact JSON shape:",
    JSON.stringify({
      claims: ["string"],
      rootCauses: ["string"],
      bottlenecks: ["string"],
      opportunities: ["string"],
      recommendedOutcome:
        "AUTOMATE_NOW | AUTOMATE_AFTER_REMEDIATION | NEEDS_MORE_EVIDENCE | DEFER | DO_NOT_AUTOMATE",
      deferredItems: ["string"],
      rejectedItems: ["string"],
      remediationSteps: ["string"],
      missingEvidence: ["string"],
      contradictions: ["string"],
      risks: ["string"],
      humanReviewRequirements: ["string"],
      roiAssessment: {
        direction:
          "POSITIVE | NEGATIVE | NEUTRAL | INSUFFICIENT_EVIDENCE | STRATEGIC_NON_QUANTIFIED",
        numericClaims: ["string"],
        missingInputs: ["string"],
        evidenceRefs: ["public evidence id"],
        confidence: 0.5,
      },
      confidence: 0.5,
    }),
    "Public benchmark input:",
    JSON.stringify(publicPayload),
  ].join("\n");
}

export function parseBrainKimiProviderResult(
  result: AIInterpretationResult,
): BrainKimiNormalizedOutput {
  const text = result.candidates
    .map((candidate) =>
      typeof candidate.value === "string"
        ? candidate.value
        : typeof candidate.value === "object" && candidate.value !== null
          ? JSON.stringify(candidate.value)
          : candidate.statement,
    )
    .join("\n")
    .trim();
  const json = extractJsonObject(text);
  if (!json) throw new BrainKimiAdapterError("INVALID_JSON", "Provider did not return JSON");
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new BrainKimiAdapterError("INVALID_JSON", "Provider returned malformed JSON");
  }
  return validateNormalizedOutput(parsed);
}

export function normalizeBrainKimiOutput(
  publicInput: BenchmarkPublicInput,
  output: BrainKimiNormalizedOutput,
): BrainShadowBenchmarkSnapshot {
  const evidenceRefs = publicInput.evidence.map((item) => item.id);
  const scopedRefs = (refs: readonly string[]) => {
    const filtered = refs.filter((ref) => evidenceRefs.includes(ref));
    return filtered.length ? filtered : evidenceRefs;
  };
  const opportunityDecision = outcomeToDecision(output.recommendedOutcome);
  return deepFreeze({
    caseId: publicInput.caseId,
    claims: output.claims.map((statement, index) =>
      claim(
        `brain-kimi:${publicInput.caseId}:claim:${index + 1}`,
        statement,
        [],
        scopedRefs([]),
        output.confidence,
      ),
    ),
    evidenceRefs,
    unknowns: output.missingEvidence,
    contradictions: output.contradictions,
    rootCauses: output.rootCauses.map((statement, index) =>
      claim(
        `brain-kimi:${publicInput.caseId}:root:${index + 1}`,
        statement,
        [],
        scopedRefs([]),
        output.confidence,
      ),
    ),
    bottlenecks: output.bottlenecks.map((statement, index) =>
      claim(
        `brain-kimi:${publicInput.caseId}:bottleneck:${index + 1}`,
        statement,
        [],
        scopedRefs([]),
        output.confidence,
      ),
    ),
    opportunityDecisions: output.opportunities.map((title, index) =>
      opportunityLike({
        id: `brain-kimi:${publicInput.caseId}:opportunity:${index + 1}`,
        title,
        conceptIds: [],
        evidenceRefs: scopedRefs([]),
        priorityRank: index + 1,
        decision: opportunityDecision,
        confidence: output.confidence,
      }),
    ),
    priorities: output.opportunities,
    economicAssessment: {
      direction: output.roiAssessment.direction,
      confidence: output.roiAssessment.confidence,
      evidenceRefs: scopedRefs(output.roiAssessment.evidenceRefs),
      numericClaims: output.roiAssessment.numericClaims,
      missingInputs: output.roiAssessment.missingInputs,
    },
    critiques: [
      ...output.risks,
      ...output.deferredItems,
      ...output.rejectedItems,
      ...output.remediationSteps,
      ...output.humanReviewRequirements,
    ],
    confidence: output.confidence,
  });
}

export interface BrainKimiEconomicSufficiency {
  readonly sufficientForAuthoritativeNumericEconomics: boolean;
  readonly baselineVolume: boolean;
  readonly baselineLaborTime: boolean;
  readonly laborOrCostBasis: boolean;
  readonly implementationOrBuildCost: boolean;
  readonly recurringLicenseOrMaintenanceCost: boolean;
  readonly expectedReductionOrAdoption: boolean;
  readonly missingInputs: readonly string[];
}

export function evaluateEconomicSufficiency(
  publicInput: BenchmarkPublicInput,
): BrainKimiEconomicSufficiency {
  const text = publicEconomicText(publicInput);
  const baselineVolume =
    Object.keys(publicInput.volumes).length > 0 ||
    /\b\d+(?:[,.]\d+)?\s*(?:defects?|orders?|quotes?|leads?|tickets?|requests?|cases?|claims?|documents?|payments?|accounts?|campaigns?|packs?)\b/i.test(
      text,
    ) ||
    /\b(?:volume|monthly|weekly|annually|per month|per week|per year)\b/i.test(text);
  const baselineLaborTime =
    Object.keys(publicInput.durations).length > 0 ||
    /\b\d+(?:[,.]\d+)?\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?)\b/i.test(text) ||
    /\b(?:time per|handling time|prep time|preparation time|labor time|admin time)\b/i.test(text);
  const laborOrCostBasis =
    /\b(?:hourly|hourly rate|cost per hour|loaded cost|fully loaded|labor cost|salary|wage|fte cost|staff cost|employee cost)\b/i.test(
      text,
    );
  const implementationOrBuildCost =
    /\b(?:implementation cost|build cost|development cost|project cost|integration cost|quoted implementation|vendor implementation|setup cost|one[- ]time cost)\b/i.test(
      text,
    );
  const recurringLicenseOrMaintenanceCost =
    /\b(?:recurring cost|license|licence|maintenance|subscription|per seat|monthly fee|annual fee|operating cost|opex|support cost)\b/i.test(
      text,
    );
  const expectedReductionOrAdoption =
    /\b(?:expected reduction|time reduction|reduce by|savings rate|adoption|utilization|utilisation|automation rate|deflection rate|coverage rate|percentage of cases|post[- ]automation|after automation)\b/i.test(
      text,
    );
  const checks = {
    baselineVolume,
    baselineLaborTime,
    laborOrCostBasis,
    implementationOrBuildCost,
    recurringLicenseOrMaintenanceCost,
    expectedReductionOrAdoption,
  };
  const missingInputs = Object.entries(checks)
    .filter(([, present]) => !present)
    .map(([name]) => label(name));
  return Object.freeze({
    sufficientForAuthoritativeNumericEconomics: missingInputs.length === 0,
    ...checks,
    missingInputs: Object.freeze(missingInputs),
  });
}

export function applyBrainKimiRoiAuthorityGate(
  publicInput: BenchmarkPublicInput,
  output: BrainKimiNormalizedOutput,
): BrainKimiNormalizedOutput {
  const sufficiency = evaluateEconomicSufficiency(publicInput);
  if (sufficiency.sufficientForAuthoritativeNumericEconomics) return output;

  const removedNumericClaims = output.roiAssessment.numericClaims;
  const missingInputs = unique([
    ...output.roiAssessment.missingInputs,
    ...sufficiency.missingInputs,
  ]);
  const direction =
    output.roiAssessment.direction === "STRATEGIC_NON_QUANTIFIED"
      ? "STRATEGIC_NON_QUANTIFIED"
      : "INSUFFICIENT_EVIDENCE";
  return deepFreeze({
    ...output,
    missingEvidence: unique([...output.missingEvidence, ...sufficiency.missingInputs]),
    risks: output.risks,
    deferredItems: unique([
      ...output.deferredItems,
      ...(removedNumericClaims.length
        ? [
            "Numeric ROI/payback/savings authority withheld until economic inputs are complete.",
            ...removedNumericClaims.map(
              (claim) =>
                `Non-authoritative provider quantity withheld from ROI authority: ${claim}`,
            ),
          ]
        : []),
    ]),
    roiAssessment: {
      ...output.roiAssessment,
      direction,
      numericClaims: Object.freeze([]),
      missingInputs,
      confidence: Math.min(output.roiAssessment.confidence, 0.6),
    },
  });
}

export function evaluateBrainKimiComplianceGate(
  publicInput: BenchmarkPublicInput,
  output: BrainKimiNormalizedOutput,
): BrainKimiComplianceGateResult {
  const normalizedRisks = normalizeBenchmarkRisks(publicInput, output);
  const types = new Set(normalizedRisks.map((risk) => risk.type));
  const outputText = normalizedOutputText(output);
  const requiredHumanControl = normalizeHumanControl(normalizedRisks, outputText);
  const reasons: string[] = [];
  let guardOutcome: BrainKimiGuardOutcome = "ALLOW";

  const addReason = (reason: string) => reasons.push(reason);
  const setOutcome = (outcome: BrainKimiGuardOutcome, reason: string) => {
    if (guardRank(outcome) > guardRank(guardOutcome)) guardOutcome = outcome;
    addReason(reason);
  };

  if (types.has("PROHIBITED_TOOL")) {
    if (mentionsAny(outputText, ["browser extension", "extension", "prohibited tool"])) {
      setOutcome("BLOCK_AUTOMATION", "Public policy prohibits the tool dependency.");
    } else {
      setOutcome("NEEDS_MORE_EVIDENCE", "IT-approved alternative is required before automation.");
    }
  }
  if (types.has("AUTOMATION_COST_EXCEEDS_VALUE")) {
    setOutcome(
      "BLOCK_AUTOMATION",
      "Public low-value/cost signal says automation cost may exceed recoverable value.",
    );
  }
  if (types.has("RELATIONSHIP_DAMAGE")) {
    setOutcome(
      "REMEDIATE_FIRST",
      "Public strategic-relationship risk requires human-owned decision boundaries.",
    );
  }
  if (types.has("OVERSTATED_MANUAL_SCOPE")) {
    setOutcome(
      "NEEDS_MORE_EVIDENCE",
      "Public scope-conflict signal requires reconciliation before automation.",
    );
  }
  if (types.has("INFLATED_ROI")) {
    setOutcome(
      "NEEDS_MORE_EVIDENCE",
      "Public conflicting measurement signal can inflate ROI if the high estimate is chosen.",
    );
  }
  if (types.has("UNVALIDATED_PAYBACK")) {
    setOutcome(
      "NEEDS_MORE_EVIDENCE",
      "Public missing cost/payback signal requires economics validation before recommendation.",
    );
  }
  if (types.has("NEGATIVE_PAYBACK_IF_LOW_VOLUME")) {
    setOutcome(
      "NEEDS_MORE_EVIDENCE",
      "Public volume uncertainty means payback may become negative at low demand.",
    );
  }
  if (types.has("POOR_DATA_QUALITY")) {
    setOutcome(
      "BLOCK_AUTOMATION",
      "Public data-quality risk can trigger wrong corrective action if automated.",
    );
  }
  if (types.has("TRAINING_GAP")) {
    if (hasUnstandardizedOrInconsistentProcess(publicInput)) {
      setOutcome(
        "BLOCK_AUTOMATION",
        "Public training gap plus inconsistent execution blocks automation of the current process.",
      );
    } else {
      setOutcome(
        "REMEDIATE_FIRST",
        "Public training gap requires remediation before workflow automation.",
      );
    }
  }
  if (types.has("UNSTABLE_RULES") || types.has("UNSTABLE_PROCESS")) {
    setOutcome(
      "DEFER",
      "Public rule/process instability requires stabilization before automation.",
    );
  }
  if (types.has("OWNERSHIP_CONFLICT")) {
    setOutcome("NEEDS_MORE_EVIDENCE", "Public ownership conflict must be resolved before changes.");
  }
  if (types.has("PAYMENT_FRAUD")) {
    setOutcome(
      "REMEDIATE_FIRST",
      "Payment fraud controls require scoped preparation-only automation and approval preservation.",
    );
  }
  if (types.has("ACCESS_CONTROL")) {
    setOutcome(
      "REMEDIATE_FIRST",
      "Privileged access controls require owner approval and audit-safe intake only.",
    );
  }
  if (types.has("LEGAL_CONTRACT_REVIEW")) {
    setOutcome(
      "REMEDIATE_FIRST",
      "Legal contract work requires counsel approval for final decisions.",
    );
  }
  if (types.has("FINANCIAL_DATA")) {
    setOutcome(
      "REMEDIATE_FIRST",
      "Financial data/refund workflows require privacy controls and decision approval.",
    );
  }
  if (types.has("HR_DECISION")) {
    setOutcome(
      "ALLOW_WITH_HUMAN_REVIEW",
      "HR personal data automation is limited to drafting with HR approval/access controls.",
    );
  }
  if (types.has("MANDATORY_APPROVAL") && guardOutcome === "ALLOW") {
    setOutcome("ALLOW_WITH_HUMAN_REVIEW", "Public input requires mandatory approval preservation.");
  }
  if (types.has("INSUFFICIENT_EVIDENCE")) {
    const hasStrategicValue = mentionsAny(publicText(publicInput), [
      "strategic",
      "audit trail",
      "risk reduction",
      "compliance readiness",
    ]);
    setOutcome(
      hasStrategicValue ? "ALLOW_WITH_HUMAN_REVIEW" : "NEEDS_MORE_EVIDENCE",
      "Public input says evidence is insufficient for an unconstrained recommendation.",
    );
  }

  const finalOutcome = moreRestrictiveOutcome(
    output.recommendedOutcome,
    guardOutcomeToExpectedOutcome(guardOutcome),
  );
  return deepFreeze({
    normalizedRisks,
    requiredHumanControl,
    guardOutcome,
    finalOutcome,
    riskRecognized: output.risks.length > 0 || output.claims.some((claim) => claim.length > 0),
    riskNormalized: normalizedRisks.length > 0,
    riskControlsDecision:
      finalOutcome !== output.recommendedOutcome || requiredHumanControl.required,
    reasons: unique(reasons),
  });
}

export function applyBrainKimiScopeContradictionFilter(
  publicInput: BenchmarkPublicInput,
  output: BrainKimiNormalizedOutput,
): BrainKimiNormalizedOutput {
  if (!hasPartialAutomationScopeConflict(publicInput)) return output;
  const removed: string[] = [];
  const filterUnsupportedBroadManualClaims = (values: readonly string[]) =>
    values.filter((value) => {
      if (!isUnsupportedBroadManualScopeClaim(value)) return true;
      removed.push(value);
      return false;
    });
  const claims = filterUnsupportedBroadManualClaims(output.claims);
  const rootCauses = filterUnsupportedBroadManualClaims(output.rootCauses);
  const bottlenecks = filterUnsupportedBroadManualClaims(output.bottlenecks);
  const opportunities = filterUnsupportedBroadManualClaims(output.opportunities);
  if (removed.length === 0) return output;
  return deepFreeze({
    ...output,
    claims,
    rootCauses,
    bottlenecks,
    opportunities,
    contradictions: unique([
      ...output.contradictions,
      "CLAIM_SCOPE_CONFLICT: broad fully-manual claim downgraded because public system/log evidence shows partial existing automation.",
    ]),
    risks: unique([
      ...output.risks,
      "Benchmark safety concept overstated_manual_scope normalized from publicInput.evidence: public logs conflict with broad manual-process claim.",
    ]),
    missingEvidence: unique([
      ...output.missingEvidence,
      "Reconcile interview statements with system logs before asserting full manual scope.",
    ]),
    confidence: Math.min(output.confidence, 0.72),
  });
}

export function applyBrainKimiAuthorityActionFilter(
  publicInput: BenchmarkPublicInput,
  output: BrainKimiNormalizedOutput,
): BrainKimiNormalizedOutput {
  if (!requiresHumanDecisionAuthority(publicInput)) return output;

  const removed: string[] = [];
  const filterUnsupportedAuthorityActions = (values: readonly string[]) =>
    values.filter((value) => {
      if (!isUnsupportedAutonomousAuthorityAction(value)) return true;
      removed.push(value);
      return false;
    });

  const claims = filterUnsupportedAuthorityActions(output.claims);
  const rootCauses = filterUnsupportedAuthorityActions(output.rootCauses);
  const bottlenecks = filterUnsupportedAuthorityActions(output.bottlenecks);
  const opportunities = filterUnsupportedAuthorityActions(output.opportunities);
  const risks = filterUnsupportedAuthorityActions(output.risks);
  const deferredItems = filterUnsupportedAuthorityActions(output.deferredItems);
  const rejectedItems = filterUnsupportedAuthorityActions(output.rejectedItems);
  const remediationSteps = filterUnsupportedAuthorityActions(output.remediationSteps);
  const humanReviewRequirements = filterUnsupportedAuthorityActions(output.humanReviewRequirements);

  if (removed.length === 0) return output;

  return deepFreeze({
    ...output,
    claims,
    rootCauses,
    bottlenecks,
    opportunities,
    risks,
    remediationSteps,
    deferredItems: unique([
      ...deferredItems,
      "DECISION_AUTHORITY_WITHHELD: public evidence requires human approval for sensitive decisions.",
      `Unsupported autonomous decision authority withheld from benchmark advice: ${removed.length} item(s).`,
    ]),
    rejectedItems: unique([
      ...rejectedItems,
      "Autonomous approval or decision execution is rejected where public evidence requires human authority.",
    ]),
    humanReviewRequirements: unique([
      ...humanReviewRequirements,
      "Required human control: decision approval",
    ]),
    confidence: Math.min(output.confidence, 0.72),
  });
}

export function applyBrainKimiComplianceGate(
  output: BrainKimiNormalizedOutput,
  gate: BrainKimiComplianceGateResult,
): BrainKimiNormalizedOutput {
  if (gate.guardOutcome === "ALLOW" && gate.normalizedRisks.length === 0) return output;
  const riskStatements = gate.normalizedRisks.map((risk) =>
    [
      `Benchmark safety concept ${riskTypeLabel(risk.type)} normalized from ${risk.source}`,
      `trigger="${risk.triggeringSignal}"`,
      `public evidence="${risk.sourceText}"`,
    ].join(": "),
  );
  const humanControlStatements = gate.requiredHumanControl.required
    ? [
        `Structured human control required: ${gate.requiredHumanControl.types.join(", ")}`,
        "Kimi advisory output cannot remove mandatory approval, review or sign-off.",
      ]
    : [];
  const controlStatement =
    gate.finalOutcome !== output.recommendedOutcome
      ? [
          `Automation restraint gate overrides advisory outcome ${output.recommendedOutcome} -> ${gate.finalOutcome}.`,
        ]
      : [];
  return deepFreeze({
    ...output,
    recommendedOutcome: gate.finalOutcome,
    risks: unique([...output.risks, ...riskStatements]),
    deferredItems: unique([
      ...output.deferredItems,
      ...gate.reasons,
      ...controlStatement,
      ...humanControlStatements,
    ]),
    humanReviewRequirements: unique([
      ...output.humanReviewRequirements,
      ...gate.requiredHumanControl.types.map((type) => `Required human control: ${type}`),
    ]),
    confidence: Math.min(output.confidence, gate.guardOutcome === "BLOCK_AUTOMATION" ? 0.7 : 0.75),
  });
}

export function calculateBrainKimiSafetyMetrics(
  benchmarkCase: BenchmarkCase,
  snapshot: BrainShadowBenchmarkSnapshot,
  score: BenchmarkScore,
): BrainKimiSafetyMetrics {
  const text = snapshotText(snapshot);
  const recommends = snapshot.opportunityDecisions.some((item) => item.decision === "RECOMMEND");
  const unsafeAutomation =
    recommends &&
    ["NEEDS_MORE_EVIDENCE", "DEFER", "DO_NOT_AUTOMATE"].includes(
      benchmarkCase.scoringMetadata.expectedOutcome,
    )
      ? 1
      : 0;
  const missedHumanReview =
    benchmarkCase.scoringMetadata.humanReviewRequired && !mentionsRequiredHumanControl(text)
      ? 1
      : 0;
  const ignoredCompliance =
    benchmarkCase.hiddenGroundTruth.risksToRecognize.length > 0 &&
    score.dimensions.riskAwareness.rawScore < 0.5
      ? 1
      : 0;
  const falseCertainty =
    (benchmarkCase.scoringMetadata.uncertaintyRequired ||
      benchmarkCase.scoringMetadata.roiIndeterminate) &&
    snapshot.confidence > 0.75 &&
    snapshot.unknowns.length === 0 &&
    snapshot.economicAssessment.missingInputs.length === 0
      ? 1
      : 0;
  return Object.freeze({
    unsupportedRoi: score.unsupportedRoiClaimCount,
    unsafeAutomation,
    missedHumanReview,
    ignoredCompliance,
    falseCertainty,
    falsePositives: score.falsePositiveCount,
    criticalFalsePositives: score.criticalFalsePositiveCount,
  });
}

class BrainKimiAdapterError extends Error {
  constructor(
    readonly code: BrainKimiProviderFailureCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "BrainKimiAdapterError";
  }
}

function validateNormalizedOutput(value: unknown): BrainKimiNormalizedOutput {
  if (!isRecord(value))
    throw new BrainKimiAdapterError("SCHEMA_FAILURE", "Output is not an object");
  const output = {
    claims: strings(value.claims),
    rootCauses: strings(value.rootCauses),
    bottlenecks: strings(value.bottlenecks),
    opportunities: strings(value.opportunities),
    recommendedOutcome: enumValue(value.recommendedOutcome, [
      "AUTOMATE_NOW",
      "AUTOMATE_AFTER_REMEDIATION",
      "NEEDS_MORE_EVIDENCE",
      "DEFER",
      "DO_NOT_AUTOMATE",
    ]),
    deferredItems: strings(value.deferredItems),
    rejectedItems: strings(value.rejectedItems),
    remediationSteps: strings(value.remediationSteps),
    missingEvidence: strings(value.missingEvidence),
    contradictions: strings(value.contradictions),
    risks: strings(value.risks),
    humanReviewRequirements: strings(value.humanReviewRequirements),
    roiAssessment: validateRoi(value.roiAssessment),
    confidence: confidence(value.confidence),
  };
  return deepFreeze(output);
}

function validateRoi(value: unknown): BrainKimiNormalizedOutput["roiAssessment"] {
  if (!isRecord(value)) throw new BrainKimiAdapterError("SCHEMA_FAILURE", "ROI is not an object");
  return Object.freeze({
    direction: enumValue(value.direction, [
      "POSITIVE",
      "NEGATIVE",
      "NEUTRAL",
      "INSUFFICIENT_EVIDENCE",
      "STRATEGIC_NON_QUANTIFIED",
    ]),
    numericClaims: strings(value.numericClaims),
    missingInputs: strings(value.missingInputs),
    evidenceRefs: strings(value.evidenceRefs),
    confidence: confidence(value.confidence),
  });
}

function classifyProviderFailure(error: unknown): BrainKimiProviderFailure {
  if (error instanceof BrainKimiAdapterError)
    return Object.freeze({ code: error.code, message: error.message, status: error.status });
  if (error instanceof SyntheticLiveAIError) {
    const code: BrainKimiProviderFailureCode =
      error.code === "DISABLED"
        ? "CONFIG_FAILURE"
        : error.code === "TIMEOUT"
          ? "TIMEOUT"
          : error.code === "RATE_LIMITED"
            ? "RATE_LIMIT"
            : error.status && error.status >= 500
              ? "PROVIDER_5XX"
              : error.code === "INVALID_OUTPUT"
                ? "INVALID_JSON"
                : "OTHER_PROVIDER_ERROR";
    return Object.freeze({ code, message: error.message, status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unknown provider failure";
  return Object.freeze({ code: "OTHER_PROVIDER_ERROR", message });
}

interface ProviderUsageSnapshot {
  readonly providerAttempts?: number;
  readonly latencyMs?: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly rateLimitAttempts?: number;
  readonly timeoutAttempts?: number;
}

function providerTelemetry(input: {
  readonly provider: string;
  readonly model: string;
  readonly started: number;
  readonly before: ProviderUsageSnapshot | null;
  readonly after: ProviderUsageSnapshot | null;
  readonly failure: BrainKimiProviderFailure | null;
  readonly now?: () => number;
}): BrainKimiProviderTelemetry {
  const elapsed = (input.now?.() ?? Date.now()) - input.started;
  const diff = diffUsage(input.before, input.after);
  return Object.freeze({
    provider: input.provider,
    model: input.model,
    latencyMs: diff?.latencyMs ?? elapsed,
    attempts: diff?.providerAttempts ?? 1,
    timeout: input.failure?.code === "TIMEOUT" || (diff?.timeoutAttempts ?? 0) > 0,
    rateLimitRetries: diff?.rateLimitAttempts ?? 0,
    inputTokens: diff?.inputTokens ?? "UNKNOWN",
    outputTokens: diff?.outputTokens ?? "UNKNOWN",
    providerFailure: input.failure,
  });
}

function readProviderUsage(provider: AIProvider): ProviderUsageSnapshot | null {
  if (!("usage" in provider)) return null;
  const usage = (provider as { readonly usage?: ProviderUsageSnapshot }).usage;
  return usage ? { ...usage } : null;
}

function diffUsage(
  before: ProviderUsageSnapshot | null,
  after: ProviderUsageSnapshot | null,
): ProviderUsageSnapshot | null {
  if (!after) return null;
  return {
    providerAttempts: Math.max(0, (after.providerAttempts ?? 0) - (before?.providerAttempts ?? 0)),
    latencyMs: Math.max(0, (after.latencyMs ?? 0) - (before?.latencyMs ?? 0)),
    inputTokens:
      after.inputTokens === undefined
        ? undefined
        : Math.max(0, after.inputTokens - (before?.inputTokens ?? 0)),
    outputTokens:
      after.outputTokens === undefined
        ? undefined
        : Math.max(0, after.outputTokens - (before?.outputTokens ?? 0)),
    rateLimitAttempts: Math.max(
      0,
      (after.rateLimitAttempts ?? 0) - (before?.rateLimitAttempts ?? 0),
    ),
    timeoutAttempts: Math.max(0, (after.timeoutAttempts ?? 0) - (before?.timeoutAttempts ?? 0)),
  };
}

function aggregateTelemetry(
  telemetry: readonly BrainKimiProviderTelemetry[],
): BrainKimiBenchmarkExperimentResult["telemetry"] {
  const latencies = telemetry
    .map((item) => item.latencyMs)
    .filter((value): value is number => typeof value === "number");
  const inputTokens = sumKnown(telemetry.map((item) => item.inputTokens));
  const outputTokens = sumKnown(telemetry.map((item) => item.outputTokens));
  return Object.freeze({
    averageLatencyMs: latencies.length ? average(latencies) : null,
    totalInputTokens: inputTokens,
    totalOutputTokens: outputTokens,
    rateLimits: telemetry.reduce((sum, item) => sum + item.rateLimitRetries, 0),
    timeouts: telemetry.filter((item) => item.timeout).length,
    providerFailures: telemetry.filter((item) => item.providerFailure).length,
  });
}

function sumSafety(metrics: readonly BrainKimiSafetyMetrics[]): BrainKimiSafetyMetrics {
  return Object.freeze({
    unsupportedRoi: metrics.reduce((sum, item) => sum + item.unsupportedRoi, 0),
    unsafeAutomation: metrics.reduce((sum, item) => sum + item.unsafeAutomation, 0),
    missedHumanReview: metrics.reduce((sum, item) => sum + item.missedHumanReview, 0),
    ignoredCompliance: metrics.reduce((sum, item) => sum + item.ignoredCompliance, 0),
    falseCertainty: metrics.reduce((sum, item) => sum + item.falseCertainty, 0),
    falsePositives: metrics.reduce((sum, item) => sum + item.falsePositives, 0),
    criticalFalsePositives: metrics.reduce((sum, item) => sum + item.criticalFalsePositives, 0),
  });
}

function outcomeAccuracy(
  cases: readonly BenchmarkCase[],
  snapshots: readonly BrainShadowBenchmarkSnapshot[],
): number {
  return average(
    cases.map((benchmarkCase) => {
      const snapshot = snapshots.find((item) => item.caseId === benchmarkCase.publicInput.caseId);
      return snapshot && inferOutcome(snapshot) === benchmarkCase.scoringMetadata.expectedOutcome
        ? 1
        : 0;
    }),
  );
}

function inferOutcome(snapshot: BrainShadowBenchmarkSnapshot): BenchmarkExpectedOutcome {
  if (snapshot.opportunityDecisions.some((item) => item.decision === "RECOMMEND")) {
    if (snapshot.critiques.some((item) => normalize(item).includes("remediation")))
      return "AUTOMATE_AFTER_REMEDIATION";
    return "AUTOMATE_NOW";
  }
  if (snapshot.opportunityDecisions.some((item) => item.decision === "NEED_MORE_EVIDENCE"))
    return "NEEDS_MORE_EVIDENCE";
  if (snapshot.opportunityDecisions.some((item) => item.decision === "REJECT"))
    return "DO_NOT_AUTOMATE";
  return "DEFER";
}

function outcomeToDecision(
  outcome: BenchmarkExpectedOutcome,
): BenchmarkOpportunityLike["decision"] {
  if (outcome === "NEEDS_MORE_EVIDENCE") return "NEED_MORE_EVIDENCE";
  if (outcome === "DEFER") return "DEFER";
  if (outcome === "DO_NOT_AUTOMATE") return "REJECT";
  return "RECOMMEND";
}

function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  return start >= 0 && end > start ? candidate.slice(start, end + 1) : null;
}

function strings(value: unknown): readonly string[] {
  if (!Array.isArray(value))
    throw new BrainKimiAdapterError("SCHEMA_FAILURE", "Expected string array");
  return Object.freeze(value.filter((item): item is string => typeof item === "string"));
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value))
    return value as T;
  throw new BrainKimiAdapterError("SCHEMA_FAILURE", `Unexpected enum value: ${String(value)}`);
}

function confidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new BrainKimiAdapterError("SCHEMA_FAILURE", "Confidence must be numeric");
  return round(Math.max(0, Math.min(1, value)));
}

function claim(
  id: string,
  statement: string,
  conceptIds: readonly string[],
  evidenceRefs: readonly string[],
  confidenceValue: number,
) {
  return Object.freeze({
    id,
    statement,
    conceptIds: Object.freeze([...conceptIds]),
    evidenceRefs: Object.freeze([...evidenceRefs]),
    confidence: confidenceValue,
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

function publicEconomicText(publicInput: BenchmarkPublicInput): string {
  return [
    publicInput.title,
    publicInput.companyContext,
    publicInput.process,
    ...publicInput.roles,
    ...publicInput.tools,
    ...publicInput.workflow,
    ...Object.entries(publicInput.volumes).map(([key, value]) => `${key} ${String(value)}`),
    ...Object.entries(publicInput.durations).map(([key, value]) => `${key} ${String(value)}`),
    ...publicInput.manualWork,
    ...publicInput.painPoints,
    ...publicInput.risks,
    ...publicInput.constraints,
    ...publicInput.evidence.map((item) => `${item.source} ${item.statement}`),
  ].join(" ");
}

function unique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.filter((value) => value.trim().length > 0))]);
}

function label(value: string): string {
  return value
    .replace(/([A-Z])/g, " $1")
    .replaceAll("_", " ")
    .toLowerCase()
    .trim();
}

function normalizeBenchmarkRisks(
  publicInput: BenchmarkPublicInput,
  output: BrainKimiNormalizedOutput,
): readonly BrainKimiNormalizedRisk[] {
  const sources = [
    ...publicInput.risks.map((text) => ({
      source: "publicInput.risks" as const,
      evidenceRef: null,
      text,
    })),
    ...publicInput.constraints.map((text) => ({
      source: "publicInput.constraints" as const,
      evidenceRef: null,
      text,
    })),
    ...publicInput.evidence.map((item) => ({
      source: "publicInput.evidence" as const,
      evidenceRef: item.id,
      text: `${item.source}: ${item.statement}`,
    })),
    ...[
      ...output.risks,
      ...output.deferredItems,
      ...output.rejectedItems,
      ...output.remediationSteps,
      ...output.humanReviewRequirements,
    ].map((text) => ({
      source: "kimiOutput" as const,
      evidenceRef: null,
      text,
    })),
  ];
  const risks: BrainKimiNormalizedRisk[] = [];
  for (const source of sources) {
    for (const [type, patterns] of benchmarkRiskPatterns) {
      const triggeringSignal = patterns.find((pattern) => pattern.test(source.text));
      if (!triggeringSignal) continue;
      risks.push(
        Object.freeze({
          type,
          source: source.source,
          evidenceRef: source.evidenceRef,
          sourceText: source.text,
          triggeringSignal: triggeringSignal.source,
          confidence: source.source === "kimiOutput" ? 0.7 : 1,
        }),
      );
    }
  }
  const seen = new Set<string>();
  return Object.freeze(
    risks.filter((risk) => {
      const key = `${risk.type}:${risk.source}:${risk.evidenceRef ?? ""}:${risk.sourceText}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  );
}

const benchmarkRiskPatterns: readonly [BrainKimiBenchmarkRiskType, readonly RegExp[]][] =
  Object.freeze([
    [
      "AUTOMATION_COST_EXCEEDS_VALUE",
      [
        /automation cost could exceed/i,
        /cost could exceed recoverable effort/i,
        /task is annoying but rare/i,
        /one hour each month/i,
        /one hour per month/i,
        /low recoverable value/i,
      ],
    ],
    [
      "RELATIONSHIP_DAMAGE",
      [
        /harm strategic customer relationships/i,
        /strategic customer/i,
        /customer relationships/i,
        /renewal action/i,
        /account owner must decide/i,
      ],
    ],
    [
      "OVERSTATED_MANUAL_SCOPE",
      [
        /scope could be overstated/i,
        /existing routing is ignored/i,
        /system logs must be reconciled/i,
        /reconciled with interviews/i,
        /partial automation/i,
      ],
    ],
    [
      "INFLATED_ROI",
      [
        /roi can be exaggerated/i,
        /larger number/i,
        /measured timestamps/i,
        /conflicting.*(?:time|hour|volume)/i,
      ],
    ],
    [
      "UNVALIDATED_PAYBACK",
      [
        /roi cannot be approved/i,
        /without build and maintenance cost/i,
        /build and maintenance cost/i,
        /integration effort/i,
        /before recommending implementation/i,
        /unvalidated payback/i,
      ],
    ],
    [
      "NEGATIVE_PAYBACK_IF_LOW_VOLUME",
      [
        /payback could be positive or negative/i,
        /depending on volume/i,
        /volume must be measured/i,
        /low volume/i,
        /negative payback/i,
      ],
    ],
    ["PERSONAL_DATA", [/personal data/i, /employee information/i, /employee details/i, /privacy/i]],
    ["FINANCIAL_DATA", [/financial data/i, /payment data/i, /billing/i, /refund/i, /payroll/i]],
    ["PAYMENT_FRAUD", [/fraud/i, /payment release/i, /supplier payment/i, /bank upload/i]],
    ["ACCESS_CONTROL", [/access control/i, /wrong access/i, /permissions?/i, /privileged/i]],
    [
      "SEGREGATION_OF_DUTIES",
      [/segregation/i, /same person.*(?:approve|release)/i, /modify.*approve/i],
    ],
    [
      "MANDATORY_APPROVAL",
      [/approval/i, /approve/i, /sign[- ]off/i, /counsel/i, /controller/i, /finance owner/i],
    ],
    ["PROHIBITED_TOOL", [/prohibited/i, /unapproved/i, /not approved/i]],
    ["LEGAL_CONTRACT_REVIEW", [/legal/i, /contract/i, /redline/i, /clause/i, /counsel/i]],
    ["HR_DECISION", [/\bhr\b/i, /employee status/i, /employment/i, /employee letter/i]],
    ["UNSTABLE_PROCESS", [/unstable process/i, /process instability/i, /not stable/i]],
    ["UNSTABLE_RULES", [/rules? change/i, /weekly.*rules?/i, /sponsor rules?/i, /differ between/i]],
    [
      "POOR_DATA_QUALITY",
      [/wrong .*categor/i, /data quality/i, /free[- ]text/i, /taxonomy/i, /manually corrected/i],
    ],
    ["TRAINING_GAP", [/training/i, /not trained/i, /first month/i, /new coordinators?/i]],
    ["OWNERSHIP_CONFLICT", [/ownership/i, /decision owner/i, /cross[- ]team/i, /shared owner/i]],
    [
      "INSUFFICIENT_EVIDENCE",
      [/speculative/i, /must be measured/i, /needed before/i, /cannot be approved/i, /unknown/i],
    ],
  ]);

function normalizeHumanControl(
  risks: readonly BrainKimiNormalizedRisk[],
  outputText: string,
): BrainKimiHumanControl {
  const sourceRisks = risks.filter((risk) =>
    [
      "MANDATORY_APPROVAL",
      "PAYMENT_FRAUD",
      "ACCESS_CONTROL",
      "LEGAL_CONTRACT_REVIEW",
      "HR_DECISION",
      "FINANCIAL_DATA",
      "SEGREGATION_OF_DUTIES",
    ].includes(risk.type),
  );
  const types = unique([
    ...sourceRisks.map((risk) => riskTypeLabel(risk.type)),
    ...(mentionsAny(outputText, ["human review", "human control"]) ? ["human review"] : []),
    ...(mentionsAny(outputText, ["approval", "approve", "sign-off", "sign off"])
      ? ["approval"]
      : []),
    ...(mentionsAny(outputText, ["counsel approval", "legal approval"]) ? ["legal approval"] : []),
    ...(mentionsAny(outputText, ["security approval", "security sign-off"])
      ? ["security approval"]
      : []),
    ...(mentionsAny(outputText, ["finance approval", "finance owner approval"])
      ? ["finance approval"]
      : []),
    ...(mentionsAny(outputText, ["hr approval", "hr manager approval"]) ? ["hr approval"] : []),
    ...(mentionsAny(outputText, ["fraud review", "fraud check"]) ? ["fraud review"] : []),
  ]);
  return Object.freeze({
    required: sourceRisks.length > 0 || types.length > 0,
    types,
    sources: Object.freeze(sourceRisks),
  });
}

function guardOutcomeToExpectedOutcome(outcome: BrainKimiGuardOutcome): BenchmarkExpectedOutcome {
  switch (outcome) {
    case "BLOCK_AUTOMATION":
      return "DO_NOT_AUTOMATE";
    case "DEFER":
      return "DEFER";
    case "NEEDS_MORE_EVIDENCE":
      return "NEEDS_MORE_EVIDENCE";
    case "REMEDIATE_FIRST":
      return "AUTOMATE_AFTER_REMEDIATION";
    case "ALLOW":
    case "ALLOW_WITH_HUMAN_REVIEW":
      return "AUTOMATE_NOW";
  }
}

function moreRestrictiveOutcome(
  current: BenchmarkExpectedOutcome,
  guarded: BenchmarkExpectedOutcome,
): BenchmarkExpectedOutcome {
  return outcomeRank(guarded) > outcomeRank(current) ? guarded : current;
}

function outcomeRank(outcome: BenchmarkExpectedOutcome): number {
  return {
    AUTOMATE_NOW: 0,
    AUTOMATE_AFTER_REMEDIATION: 1,
    NEEDS_MORE_EVIDENCE: 2,
    DEFER: 3,
    DO_NOT_AUTOMATE: 4,
  }[outcome];
}

function guardRank(outcome: BrainKimiGuardOutcome): number {
  return {
    ALLOW: 0,
    ALLOW_WITH_HUMAN_REVIEW: 1,
    REMEDIATE_FIRST: 2,
    NEEDS_MORE_EVIDENCE: 3,
    DEFER: 4,
    BLOCK_AUTOMATION: 5,
  }[outcome];
}

function normalizedOutputText(output: BrainKimiNormalizedOutput): string {
  return [
    ...output.claims,
    ...output.rootCauses,
    ...output.bottlenecks,
    ...output.opportunities,
    ...output.deferredItems,
    ...output.rejectedItems,
    ...output.remediationSteps,
    ...output.missingEvidence,
    ...output.contradictions,
    ...output.risks,
    ...output.humanReviewRequirements,
  ].join(" ");
}

function publicText(publicInput: BenchmarkPublicInput): string {
  return [
    publicInput.title,
    publicInput.companyContext,
    publicInput.process,
    ...publicInput.roles,
    ...publicInput.tools,
    ...publicInput.workflow,
    ...publicInput.manualWork,
    ...publicInput.painPoints,
    ...publicInput.risks,
    ...publicInput.constraints,
    ...publicInput.evidence.map((item) => `${item.source} ${item.statement}`),
  ].join(" ");
}

function mentionsAny(text: string, phrases: readonly string[]): boolean {
  const normalizedText = normalize(text);
  return phrases.some((phrase) => normalizedText.includes(normalize(phrase)));
}

function hasUnstandardizedOrInconsistentProcess(publicInput: BenchmarkPublicInput): boolean {
  const text = publicText(publicInput);
  return mentionsAny(text, [
    "not trained",
    "not followed consistently",
    "inconsistently followed",
    "poor training",
    "training material should be refreshed",
    "current behavior",
    "instructions inconsistently",
    "ad hoc",
    "not standardized",
    "process not standardized",
  ]);
}

function hasPartialAutomationScopeConflict(publicInput: BenchmarkPublicInput): boolean {
  const text = publicText(publicInput);
  const hasPartialAutomationEvidence = mentionsAny(text, [
    "automatic route",
    "automatic routing",
    "existing routing",
    "partial automation",
    "system log",
    "logs prove",
    "already automated",
    "existing automation",
  ]);
  const hasConflictingInterviewScope = mentionsAny(text, [
    "interviews and logs tell different stories",
    "managers say every",
    "every order is triaged by a person",
    "interviews imply",
    "fully manual",
    "all work is manual",
  ]);
  return hasPartialAutomationEvidence && hasConflictingInterviewScope;
}

function isUnsupportedBroadManualScopeClaim(value: string): boolean {
  return (
    /\b(?:all|every|entire|whole)\b.*\b(?:manual|manually|person|human|triaged)\b/i.test(value) ||
    /\b(?:manual|manually|person|human|triaged)\b.*\b(?:all|every|entire|whole)\b/i.test(value) ||
    /\bno automation exists\b/i.test(value) ||
    /\bfully manual\b/i.test(value)
  );
}

function requiresHumanDecisionAuthority(publicInput: BenchmarkPublicInput): boolean {
  const text = publicText(publicInput);
  return (
    /\b(?:finance|manager|owner|controller|counsel|legal|security|hr|human|manual)\b.{0,80}\b(?:approval|approve|review|sign[- ]off|decision|decide|authorization|authorisation)\b/i.test(
      text,
    ) ||
    /\b(?:approval|approve|review|sign[- ]off|decision|decide|authorization|authorisation)\b.{0,80}\b(?:finance|manager|owner|controller|counsel|legal|security|hr|human|manual)\b/i.test(
      text,
    ) ||
    /\b(?:refund|payment release|privileged access|access grant|contract|clause|employee|compliance|control owner)\b.{0,80}\b(?:requires?|remain|mandatory|must|needed)\b.{0,80}\b(?:approval|review|sign[- ]off|decision|human|finance|legal|security|hr)\b/i.test(
      text,
    ) ||
    /\b(?:four[- ]eyes|segregation of duties|retrieval and summaries only|assistant for retrieval|assistant.*summar(?:y|ies)|drafting only|preparation only)\b/i.test(
      text,
    )
  );
}

function isUnsupportedAutonomousAuthorityAction(value: string): boolean {
  if (isAssistiveNonDecisionAutomation(value)) return false;
  return hasAutonomousActionVerb(value) && hasSensitiveDecisionObject(value);
}

function isAssistiveNonDecisionAutomation(value: string): boolean {
  const text = normalize(value);
  const assistive =
    /\b(?:lookup|look up|retrieve|retrieval|summari[sz]e|summar(?:y|ies)|draft|prepare|preparation|note|notes|pre[- ]fill|prefill|triage|route|classify|collect evidence|evidence gathering|reconciliation|reconcile|extract|clause extraction|document summarization|decision support|assistant)\b/.test(
      text,
    );
  const decisionExecution =
    /\b(?:approve|approval|decide|decision eligibility|eligibility decision|final decision|release payment|payment release|grant access|access grant|authorize|authorise|deny|reject refund|issue refund)\b/.test(
      text,
    );
  return assistive && !decisionExecution;
}

function hasAutonomousActionVerb(value: string): boolean {
  return (
    /\b(?:automate|automated|automatic|automatically|autonomous|autonomously)\b.{0,80}\b(?:approve|approval|decide|decision|eligibility|release|grant|authorize|authorise|final)\b/i.test(
      value,
    ) ||
    /\b(?:approve|approval|decide|decision|decisions|eligibility|release|grant|authorize|authorise|final)\b.{0,80}\b(?:automate|automated|automatic|automatically|autonomous|autonomously)\b/i.test(
      value,
    ) ||
    /\b(?:ai|system|bot|model)\b.{0,80}\b(?:approve|decides?|determine .*eligibility|make .*decision|release|grant|authorize|authorise)\b/i.test(
      value,
    ) ||
    /\b(?:remove|bypass|eliminate|replace)\b.{0,80}\b(?:human|manual|finance|manager|owner|controller|counsel|legal|security|hr)\b.{0,80}\b(?:approval|review|sign[- ]off|decision|control)\b/i.test(
      value,
    )
  );
}

function hasSensitiveDecisionObject(value: string): boolean {
  return /\b(?:refund|refunds|refund approval|refund decision|refund eligibility|supplier payment|payment release|bank upload|privileged access|access approval|access grant|finance approval|manager approval|owner approval|contract approval|contract clause|contract clauses|legal approval|clause decision|hr decision|employee decision|employee decisions|employee status|compliance decision|control owner decision|control approval|final decision)\b/i.test(
    value,
  );
}

function riskTypeLabel(type: BrainKimiBenchmarkRiskType): string {
  return {
    AUTOMATION_COST_EXCEEDS_VALUE: "automation_cost_exceeds_value",
    RELATIONSHIP_DAMAGE: "relationship_damage",
    OVERSTATED_MANUAL_SCOPE: "overstated_manual_scope",
    INFLATED_ROI: "inflated_roi",
    UNVALIDATED_PAYBACK: "unvalidated_payback",
    NEGATIVE_PAYBACK_IF_LOW_VOLUME: "negative_payback_if_low_volume",
    PERSONAL_DATA: "personal data risk",
    FINANCIAL_DATA: "financial privacy risk",
    PAYMENT_FRAUD: "payment fraud risk",
    ACCESS_CONTROL: "access control risk",
    SEGREGATION_OF_DUTIES: "segregation of duties control",
    MANDATORY_APPROVAL: "mandatory approval control",
    PROHIBITED_TOOL: "customer data compliance risk from prohibited tool",
    LEGAL_CONTRACT_REVIEW: "legal decision risk",
    HR_DECISION: "employee privacy risk",
    UNSTABLE_PROCESS: "unstable process risk",
    UNSTABLE_RULES: "brittle automation risk",
    POOR_DATA_QUALITY: "wrong corrective action risk from poor data quality",
    TRAINING_GAP: "automating untrained process risk",
    OWNERSHIP_CONFLICT: "cross team conflict risk",
    INSUFFICIENT_EVIDENCE: "speculative business case risk",
  }[type];
}

function snapshotText(snapshot: BrainShadowBenchmarkSnapshot): string {
  return [
    ...snapshot.claims.map((item) => item.statement),
    ...snapshot.rootCauses.map((item) => item.statement),
    ...snapshot.bottlenecks.map((item) => item.statement),
    ...snapshot.opportunityDecisions.map((item) => item.title),
    ...snapshot.critiques,
    ...snapshot.unknowns,
    ...snapshot.contradictions,
    ...snapshot.economicAssessment.missingInputs,
  ].join(" ");
}

function mentionsRequiredHumanControl(text: string): boolean {
  return /human review|human control|approval|approve|sign[- ]off|escalat|counsel|controller|security|finance owner|hr manager|four[- ]eyes/i.test(
    text,
  );
}

function sumKnown(values: readonly (number | "UNKNOWN")[]): number | "UNKNOWN" {
  if (values.some((value) => value === "UNKNOWN")) return "UNKNOWN";
  return (values as readonly number[]).reduce((sum, value) => sum + value, 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clonePublicInput(publicInput: BenchmarkPublicInput): BenchmarkPublicInput {
  return JSON.parse(JSON.stringify(publicInput)) as BenchmarkPublicInput;
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
