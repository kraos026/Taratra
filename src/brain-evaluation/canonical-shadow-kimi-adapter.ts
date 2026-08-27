import { canonicalShadowCases } from "./canonical-shadow-scenarios";
import { createBrainOnlyShadowSnapshot } from "./canonical-shadow-benchmark";
import { scoreBrainSnapshot } from "./canonical-shadow-scorer";
import {
  LiveSyntheticAIProvider,
  OpenAICompatibleSyntheticTransport,
  readLiveSyntheticAIConfig,
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
  readonly telemetry: BrainKimiProviderTelemetry;
  readonly failure: BrainKimiProviderFailure | null;
}

export interface BrainKimiCaseExperimentResult {
  readonly caseId: string;
  readonly brainOnlySnapshot: BrainShadowBenchmarkSnapshot;
  readonly brainOnlyScore: BenchmarkScore;
  readonly brainOnlySafetyMetrics: BrainKimiSafetyMetrics;
  readonly brainKimiSnapshot: BrainShadowBenchmarkSnapshot | null;
  readonly brainKimiScore: BenchmarkScore | null;
  readonly brainKimiSafetyMetrics: BrainKimiSafetyMetrics | null;
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
      const gatedOutput = applyBrainKimiRoiAuthorityGate(publicInput, output);
      const snapshot = normalizeBrainKimiOutput(publicInput, gatedOutput);
      return Object.freeze({
        snapshot,
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
    config,
    "BENCHMARK_ANALYSIS",
  );
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
        brainKimiSnapshot: kimi.snapshot,
        brainKimiScore,
        brainKimiSafetyMetrics:
          kimi.snapshot && brainKimiScore
            ? calculateBrainKimiSafetyMetrics(benchmarkCase, kimi.snapshot, brainKimiScore)
            : null,
        brainKimiProviderTelemetry: kimi.telemetry,
        providerFailure: kimi.failure,
      }),
    );
  }

  const successfulKimi = perCase.filter((item) => item.brainKimiScore);
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
    benchmarkCase.scoringMetadata.humanReviewRequired && !mentionsHumanReview(text) ? 1 : 0;
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

function mentionsHumanReview(text: string): boolean {
  return /human|review|approval|approve|escalat|manual/i.test(text);
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
