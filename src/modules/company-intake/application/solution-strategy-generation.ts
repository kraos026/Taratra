import type {
  AICandidate,
  AIInterpretationRequest,
  AIInterpretationResult,
  AIProvider,
} from "../../../brain-evaluation/ai-interpretation-gateway";
import { AIInterpretationGateway } from "../../../brain-evaluation/ai-interpretation-gateway";
import type { Evidence } from "../../../brain-evaluation/brain-contracts";
import type { EconomicSignal } from "../../../brain-evaluation/economic-intelligence";
import type { HypothesisCandidate } from "../../../brain-evaluation/hypothesis-expansion";
import type { OpportunityCandidate } from "../../../brain-evaluation/opportunity-intelligence";
import type { ProductionDiscoveryTarget } from "./adaptive-discovery-production-bridge";
import type { ExecutiveEconomicState } from "./executive-decision-view";

export type SolutionStrategyFamily =
  | "PROCESS_REDESIGN"
  | "DATA_REMEDIATION"
  | "CONTROL_IMPROVEMENT"
  | "NATIVE_SYSTEM_CONFIGURATION"
  | "NATIVE_SYSTEM_AUTOMATION"
  | "LOW_CODE_AUTOMATION"
  | "API_INTEGRATION"
  | "RPA"
  | "AI_ASSISTED_WORKFLOW"
  | "HUMAN_IN_THE_LOOP_AUTOMATION"
  | "OBSERVABILITY_IMPROVEMENT"
  | "MANUAL_PROCESS_WITH_BETTER_CONTROL"
  | "DO_NOTHING"
  | "DEFER";

export type StrategyCandidateScale = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
export type StrategyReversibility = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
export type SolutionStrategyValidationStatus =
  | "RETAIN_FOR_COMPARISON"
  | "NEEDS_MORE_EVIDENCE"
  | "BLOCKED_BY_REMEDIATION"
  | "CONTROL_CONFLICT"
  | "ECONOMICALLY_WEAK"
  | "REJECTED";

export interface StrategyProviderMetadata {
  readonly provider: string;
  readonly model: string;
  readonly aiGenerated: boolean;
}

export interface SolutionStrategyCandidate {
  readonly candidateId: string;
  readonly strategyFamily: SolutionStrategyFamily;
  readonly title: string;
  readonly summary: string;
  readonly problemAddressed: string;
  readonly rootCauseAddressed: string;
  readonly prerequisites: readonly string[];
  readonly preservedHumanControls: readonly string[];
  readonly requiredSystems: readonly string[];
  readonly requiredData: readonly string[];
  readonly implementationComplexityCandidate: StrategyCandidateScale;
  readonly operationalRiskCandidate: StrategyCandidateScale;
  readonly maintenanceBurdenCandidate: StrategyCandidateScale;
  readonly reversibilityCandidate: StrategyReversibility;
  readonly economicDependencyRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly processNodeRefs: readonly string[];
  readonly keyAssumptions: readonly string[];
  readonly unknowns: readonly string[];
  readonly advantages: readonly string[];
  readonly tradeoffs: readonly string[];
  readonly failureModes: readonly string[];
  readonly noveltyKey: string;
  readonly providerMetadata: StrategyProviderMetadata;
  readonly authoritativeRecommendationStatus: null;
}

export interface SolutionStrategyInput {
  readonly tenantId: string;
  readonly companyId: string;
  readonly brainRunId: string;
  readonly problem: string;
  readonly rootCauseOrHypothesis: string;
  readonly bottleneck?: string;
  readonly criticalIssue?: string;
  readonly opportunity?: Pick<
    OpportunityCandidate,
    | "opportunityId"
    | "subject"
    | "candidateType"
    | "status"
    | "supportingEvidenceIds"
    | "processStepIds"
    | "solutionPatternIds"
    | "prerequisites"
  >;
  readonly remediationRequirements?: readonly string[];
  readonly doNotAutomateConstraints?: readonly string[];
  readonly economicState: Readonly<{
    readonly state: ExecutiveEconomicState | "UNKNOWN";
    readonly signal?: EconomicSignal;
    readonly evidenceRefs: readonly string[];
    readonly missingEvidence?: readonly string[];
  }>;
  readonly processContext: readonly {
    readonly nodeId: string;
    readonly name: string;
    readonly systems?: readonly string[];
    readonly controls?: readonly string[];
    readonly humanDecision?: boolean;
  }[];
  readonly systemsContext: readonly {
    readonly systemId: string;
    readonly name: string;
    readonly capabilities?: readonly string[];
    readonly evidenceRefs?: readonly string[];
  }[];
  readonly controlRequirements: readonly {
    readonly controlId: string;
    readonly description: string;
    readonly mandatory: boolean;
    readonly humanApprovalRequired: boolean;
    readonly evidenceRefs: readonly string[];
  }[];
  readonly knownCompanyConstraints?: readonly string[];
  readonly evidence: readonly Evidence[];
  readonly retainedHypotheses?: readonly HypothesisCandidate[];
  readonly knowledgePatternIds?: readonly string[];
  readonly strategyBudget?: number;
}

export interface StrategyDependency {
  readonly prerequisiteCandidateId: string;
  readonly dependentCandidateId: string;
  readonly reason: string;
}

export interface StrategyComparisonItem {
  readonly candidateId: string;
  readonly strategyFamily: SolutionStrategyFamily;
  readonly title: string;
  readonly fitRationale: string;
  readonly evidenceState: "SUPPORTED" | "PARTIAL" | "UNKNOWN" | "CONFLICTED";
  readonly prerequisites: readonly string[];
  readonly riskControlCompatibility: "COMPATIBLE" | "CONDITIONAL" | "CONFLICT";
  readonly economicState: ExecutiveEconomicState | "UNKNOWN";
  readonly unknowns: readonly string[];
  readonly status: SolutionStrategyValidationStatus;
  readonly discoveryTargets: readonly StrategyDiscoveryTarget[];
}

export interface StrategyComparisonReadModel {
  readonly problem: string;
  readonly strategies: readonly StrategyComparisonItem[];
  readonly dependencies: readonly StrategyDependency[];
  readonly aiScoreUsed: false;
  readonly blueprintPublicationCount: 0;
  readonly specificationPublicationCount: 0;
  readonly aiRecommendationAuthorityCount: 0;
}

export interface StrategyDiscoveryTarget {
  readonly targetSource: ProductionDiscoveryTarget;
  readonly reason: string;
  readonly evidenceNeeded: string;
  readonly relatedCandidateId: string;
}

export interface SolutionStrategyGenerationResult {
  readonly tenantId: string;
  readonly companyId: string;
  readonly brainRunId: string;
  readonly candidates: readonly SolutionStrategyCandidate[];
  readonly rejectedCandidates: readonly {
    readonly candidateId: string;
    readonly reason: SolutionStrategyValidationStatus | "DUPLICATE" | "UNSUPPORTED_FAMILY";
    readonly detail: string;
  }[];
  readonly comparison: StrategyComparisonReadModel;
  readonly metrics: Readonly<{
    readonly strategiesGenerated: number;
    readonly strategyFamiliesRepresented: number;
    readonly duplicatesRemoved: number;
    readonly unsupportedCandidatesRejected: number;
    readonly controlConflictsRejected: number;
    readonly candidatesRetained: number;
    readonly candidatesNeedingEvidence: number;
    readonly remediationFirstCandidates: number;
    readonly nonAutomationStrategiesRetained: number;
    readonly directBlueprintPublication: 0;
    readonly directSpecificationPublication: 0;
    readonly aiRecommendationAuthority: 0;
    readonly inventedEconomicsAccepted: 0;
    readonly inventedSystemCapabilitiesAccepted: 0;
    readonly controlBypassAccepted: 0;
    readonly crossCompanyLeakage: 0;
  }>;
  readonly providerUnavailable: boolean;
}

export class SolutionStrategyGenerationService {
  constructor(private readonly provider?: AIProvider) {}

  async generate(input: SolutionStrategyInput): Promise<SolutionStrategyGenerationResult> {
    validateInput(input);
    const budget = Math.max(1, Math.min(8, input.strategyBudget ?? 6));
    const providerCandidates = await this.providerCandidates(input);
    const raw = providerCandidates.candidates.length
      ? providerCandidates.candidates
      : deterministicCandidates(input);
    const normalized = raw
      .map((candidate, index) => normalizeCandidate(candidate, input, index))
      .filter((candidate): candidate is SolutionStrategyCandidate => Boolean(candidate));
    const deduped = dedupe(normalized);
    const rejected = [...deduped.rejected];
    const retained: SolutionStrategyCandidate[] = [];
    const comparisonItems: StrategyComparisonItem[] = [];
    for (const candidate of deduped.candidates.slice(0, budget)) {
      const validation = validateCandidate(candidate, input);
      if (validation.status === "REJECTED" || validation.status === "CONTROL_CONFLICT") {
        rejected.push({
          candidateId: candidate.candidateId,
          reason: validation.status,
          detail: validation.fitRationale,
        });
        continue;
      }
      retained.push(candidate);
      comparisonItems.push(validation);
    }
    const dependencies = dependenciesFor(retained);
    return deepFreeze({
      tenantId: input.tenantId,
      companyId: input.companyId,
      brainRunId: input.brainRunId,
      candidates: retained,
      rejectedCandidates: rejected,
      comparison: {
        problem: input.problem,
        strategies: comparisonItems,
        dependencies,
        aiScoreUsed: false,
        blueprintPublicationCount: 0,
        specificationPublicationCount: 0,
        aiRecommendationAuthorityCount: 0,
      },
      metrics: metricsFor(raw, retained, rejected, comparisonItems, deduped.duplicatesRemoved),
      providerUnavailable: providerCandidates.providerUnavailable,
    });
  }

  private async providerCandidates(input: SolutionStrategyInput): Promise<{
    readonly candidates: readonly Partial<SolutionStrategyCandidate>[];
    readonly providerUnavailable: boolean;
  }> {
    if (!this.provider) return { candidates: [], providerUnavailable: true };
    try {
      const gateway = new AIInterpretationGateway(this.provider);
      const result = await gateway.interpret(requestFor(input));
      return {
        candidates: result.candidates.map((candidate) => fromAICandidate(candidate, result)),
        providerUnavailable: false,
      };
    } catch {
      return { candidates: [], providerUnavailable: true };
    }
  }
}

function requestFor(input: SolutionStrategyInput): AIInterpretationRequest {
  return {
    requestId: `${input.brainRunId}:solution-strategy-generation`,
    tenantId: input.tenantId,
    companyId: input.companyId,
    sourceId: input.opportunity?.opportunityId ?? input.brainRunId,
    sourceType: "QUALIFIED_ANALYSIS",
    sourceText: boundedSource(input),
    task: "SOLUTION_STRATEGY_GENERATION",
    schemaVersion: "solution-strategy-candidates-v1",
    knownClaims: [
      input.problem,
      input.rootCauseOrHypothesis,
      ...(input.remediationRequirements ?? []),
      ...(input.doNotAutomateConstraints ?? []),
    ],
    knownUnknowns: [
      ...(input.economicState.missingEvidence ?? []),
      ...input.systemsContext.flatMap((system) =>
        system.capabilities?.length ? [] : [`${system.name} capability unknown`],
      ),
    ],
    constraints: Object.freeze([
      "Return strategy candidates only, not recommendations.",
      "Do not invent ROI, payback, vendor pricing, API capability or system capability.",
      "Do not remove mandatory human controls.",
      "Include non-automation options when evidence or economics is weak.",
    ]),
    traceContext: {
      companyId: input.companyId,
      brainRunId: input.brainRunId,
      opportunityId: input.opportunity?.opportunityId ?? "none",
    },
  };
}

function fromAICandidate(
  candidate: AICandidate,
  result: AIInterpretationResult,
): Partial<SolutionStrategyCandidate> {
  const value = asRecord(candidate.value);
  return {
    candidateId: text(value.candidateId) ?? candidate.candidateId,
    strategyFamily: family(text(value.strategyFamily)),
    title: text(value.title) ?? candidate.statement,
    summary: text(value.summary) ?? candidate.rationale,
    problemAddressed: text(value.problemAddressed),
    rootCauseAddressed: text(value.rootCauseAddressed),
    prerequisites: stringList(value.prerequisites),
    preservedHumanControls: stringList(value.preservedHumanControls),
    requiredSystems: stringList(value.requiredSystems),
    requiredData: stringList(value.requiredData),
    implementationComplexityCandidate: scale(value.implementationComplexityCandidate),
    operationalRiskCandidate: scale(value.operationalRiskCandidate),
    maintenanceBurdenCandidate: scale(value.maintenanceBurdenCandidate),
    reversibilityCandidate: reversibility(value.reversibilityCandidate),
    economicDependencyRefs: stringList(value.economicDependencyRefs),
    evidenceRefs: stringList(value.evidenceRefs),
    processNodeRefs: stringList(value.processNodeRefs),
    keyAssumptions: stringList(value.keyAssumptions),
    unknowns: stringList(value.unknowns),
    advantages: stringList(value.advantages),
    tradeoffs: stringList(value.tradeoffs),
    failureModes: stringList(value.failureModes),
    noveltyKey: text(value.noveltyKey),
    providerMetadata: {
      provider: result.provider,
      model: result.model,
      aiGenerated: true,
    },
  };
}

function deterministicCandidates(
  input: SolutionStrategyInput,
): readonly SolutionStrategyCandidate[] {
  const providerMetadata = {
    provider: "deterministic-patterns",
    model: "local-v1",
    aiGenerated: false,
  };
  const evidenceRefs = evidenceRefsFor(input);
  const processNodeRefs = processRefsFor(input);
  const base = {
    problemAddressed: input.problem,
    rootCauseAddressed: input.rootCauseOrHypothesis,
    economicDependencyRefs: input.economicState.evidenceRefs,
    evidenceRefs,
    processNodeRefs,
    providerMetadata,
    authoritativeRecommendationStatus: null,
  };
  const candidates: SolutionStrategyCandidate[] = [];
  if (
    input.remediationRequirements?.length ||
    /data|duplicate|missing|stale/i.test(input.rootCauseOrHypothesis)
  ) {
    candidates.push(
      candidate({
        ...base,
        candidateId: `${input.brainRunId}:strategy:data-remediation`,
        strategyFamily: "DATA_REMEDIATION",
        title: "Fix the source data before automation",
        summary: "Clean and stabilize the records that currently make the process unreliable.",
        prerequisites: input.remediationRequirements?.length
          ? input.remediationRequirements
          : ["Identify authoritative data owner", "Resolve duplicate or missing identifiers"],
        preservedHumanControls: controls(input),
        requiredSystems: systems(input),
        requiredData: ["authoritative master data", "data quality exceptions"],
        implementationComplexityCandidate: "MEDIUM",
        operationalRiskCandidate: "LOW",
        maintenanceBurdenCandidate: "MEDIUM",
        reversibilityCandidate: "HIGH",
        keyAssumptions: ["Data quality is a material contributor to the problem"],
        unknowns: [],
        advantages: ["Reduces failure before automation is considered"],
        tradeoffs: ["Does not remove manual work immediately"],
        failureModes: ["Data ownership remains unclear", "Duplicate records reappear"],
        noveltyKey: "data-remediation-first",
      }),
    );
  }
  candidates.push(
    candidate({
      ...base,
      candidateId: `${input.brainRunId}:strategy:native-config`,
      strategyFamily: "NATIVE_SYSTEM_CONFIGURATION",
      title: "Use native system configuration first",
      summary:
        "Check whether existing systems can enforce rules or reduce handoffs without custom build.",
      prerequisites: ["Confirm native capability with IT or vendor documentation"],
      preservedHumanControls: controls(input),
      requiredSystems: systems(input),
      requiredData: ["system capability evidence"],
      implementationComplexityCandidate: "LOW",
      operationalRiskCandidate: "LOW",
      maintenanceBurdenCandidate: "LOW",
      reversibilityCandidate: "HIGH",
      keyAssumptions: ["Existing systems may support relevant configuration"],
      unknowns: systems(input).length
        ? ["native capability evidence"]
        : ["system capability evidence"],
      advantages: ["Avoids unnecessary custom integration"],
      tradeoffs: ["May be limited by current system capabilities"],
      failureModes: ["Native capability is unavailable", "Configuration is too coarse"],
      noveltyKey: "native-system-first",
    }),
    candidate({
      ...base,
      candidateId: `${input.brainRunId}:strategy:hitl`,
      strategyFamily: "HUMAN_IN_THE_LOOP_AUTOMATION",
      title: "Automate preparation while preserving human approval",
      summary:
        "Route, pre-fill and notify around the decision while keeping protected human judgment intact.",
      prerequisites: ["Clarify approval rules", "Define escalation ownership"],
      preservedHumanControls: controls(input).length
        ? controls(input)
        : ["human review of exceptions"],
      requiredSystems: systems(input),
      requiredData: ["approval state", "exception context"],
      implementationComplexityCandidate: "MEDIUM",
      operationalRiskCandidate: "MEDIUM",
      maintenanceBurdenCandidate: "MEDIUM",
      reversibilityCandidate: "MEDIUM",
      keyAssumptions: ["Human decision remains valuable or mandatory"],
      unknowns: [],
      advantages: ["Reduces waiting without bypassing control"],
      tradeoffs: ["Still requires human response"],
      failureModes: ["Notifications are ignored", "Exception backlog accumulates"],
      noveltyKey: "human-in-loop-routing",
    }),
    candidate({
      ...base,
      candidateId: `${input.brainRunId}:strategy:observability`,
      strategyFamily: "OBSERVABILITY_IMPROVEMENT",
      title: "Improve queue visibility and operational signals",
      summary: "Expose bottleneck state, ageing and ownership so teams can intervene earlier.",
      prerequisites: ["Define queue states", "Agree escalation thresholds"],
      preservedHumanControls: controls(input),
      requiredSystems: systems(input),
      requiredData: ["timestamped queue events"],
      implementationComplexityCandidate: "LOW",
      operationalRiskCandidate: "LOW",
      maintenanceBurdenCandidate: "LOW",
      reversibilityCandidate: "HIGH",
      keyAssumptions: ["Visibility changes behaviour"],
      unknowns: [],
      advantages: ["Low-risk first improvement"],
      tradeoffs: ["Does not remove root cause by itself"],
      failureModes: ["Alerts become noise", "Queue ownership remains unclear"],
      noveltyKey: "queue-observability",
    }),
  );
  if (!input.doNotAutomateConstraints?.length) {
    candidates.push(
      candidate({
        ...base,
        candidateId: `${input.brainRunId}:strategy:api-integration`,
        strategyFamily: "API_INTEGRATION",
        title: "Integrate systems through a controlled API workflow",
        summary:
          "Synchronize approved data and status changes through explicit integration boundaries.",
        prerequisites: ["Confirm API availability", "Define idempotency and failure handling"],
        preservedHumanControls: controls(input),
        requiredSystems: systems(input),
        requiredData: ["API contract evidence", "mapping rules"],
        implementationComplexityCandidate: "HIGH",
        operationalRiskCandidate: "MEDIUM",
        maintenanceBurdenCandidate: "MEDIUM",
        reversibilityCandidate: "LOW",
        keyAssumptions: ["Systems expose stable APIs"],
        unknowns: ["API capability evidence"],
        advantages: ["Can remove manual transfer when evidence supports it"],
        tradeoffs: ["Higher implementation and maintenance burden"],
        failureModes: ["API downtime", "silent integration failure", "duplicate processing"],
        noveltyKey: "controlled-api-integration",
      }),
    );
  }
  if (
    input.economicState.state === "NOT_JUSTIFIED" ||
    input.economicState.signal === "NEGATIVE_VALUE"
  ) {
    candidates.push(
      candidate({
        ...base,
        candidateId: `${input.brainRunId}:strategy:defer`,
        strategyFamily: "DEFER",
        title: "Defer automation and keep a controlled manual process",
        summary: "Avoid investing in automation until volume, risk or evidence changes.",
        prerequisites: ["Track volume and exception trend"],
        preservedHumanControls: controls(input),
        requiredSystems: [],
        requiredData: ["future volume evidence"],
        implementationComplexityCandidate: "LOW",
        operationalRiskCandidate: "LOW",
        maintenanceBurdenCandidate: "LOW",
        reversibilityCandidate: "HIGH",
        keyAssumptions: ["Current evidence does not justify transformation spend"],
        unknowns: input.economicState.missingEvidence ?? [],
        advantages: ["Avoids low-value automation"],
        tradeoffs: ["Manual effort remains"],
        failureModes: ["Volume grows without re-evaluation"],
        noveltyKey: "defer-low-value",
      }),
    );
  }
  return Object.freeze(candidates);
}

function normalizeCandidate(
  partial: Partial<SolutionStrategyCandidate>,
  input: SolutionStrategyInput,
  index: number,
): SolutionStrategyCandidate | null {
  const strategyFamily = family(partial.strategyFamily);
  if (!strategyFamily) return null;
  return candidate({
    candidateId: partial.candidateId ?? `${input.brainRunId}:strategy:${index + 1}`,
    strategyFamily,
    title: partial.title ?? strategyFamily.toLowerCase().replaceAll("_", " "),
    summary: partial.summary ?? "Candidate transformation strategy",
    problemAddressed: partial.problemAddressed ?? input.problem,
    rootCauseAddressed: partial.rootCauseAddressed ?? input.rootCauseOrHypothesis,
    prerequisites: partial.prerequisites ?? [],
    preservedHumanControls: partial.preservedHumanControls ?? controls(input),
    requiredSystems: partial.requiredSystems ?? [],
    requiredData: partial.requiredData ?? [],
    implementationComplexityCandidate: partial.implementationComplexityCandidate ?? "UNKNOWN",
    operationalRiskCandidate: partial.operationalRiskCandidate ?? "UNKNOWN",
    maintenanceBurdenCandidate: partial.maintenanceBurdenCandidate ?? "UNKNOWN",
    reversibilityCandidate: partial.reversibilityCandidate ?? "UNKNOWN",
    economicDependencyRefs: partial.economicDependencyRefs ?? input.economicState.evidenceRefs,
    evidenceRefs: partial.evidenceRefs?.length ? partial.evidenceRefs : evidenceRefsFor(input),
    processNodeRefs: partial.processNodeRefs?.length
      ? partial.processNodeRefs
      : processRefsFor(input),
    keyAssumptions: partial.keyAssumptions ?? [],
    unknowns: partial.unknowns ?? [],
    advantages: partial.advantages ?? [],
    tradeoffs: partial.tradeoffs ?? [],
    failureModes: partial.failureModes ?? [],
    noveltyKey: partial.noveltyKey ?? `${strategyFamily}:${partial.title ?? index}`,
    providerMetadata: partial.providerMetadata ?? {
      provider: "unknown",
      model: "unknown",
      aiGenerated: true,
    },
    authoritativeRecommendationStatus: null,
  });
}

function validateCandidate(
  candidate: SolutionStrategyCandidate,
  input: SolutionStrategyInput,
): StrategyComparisonItem {
  const inventedEconomics = containsInventedEconomics(candidate);
  const unsupportedCapability = inventedSystemCapability(candidate, input);
  const controlConflict = bypassesControl(candidate, input);
  let status: SolutionStrategyValidationStatus = "RETAIN_FOR_COMPARISON";
  const discoveryTargets: StrategyDiscoveryTarget[] = [];
  let fitRationale = "Candidate is retained only for deterministic comparison.";
  if (inventedEconomics) {
    status = "REJECTED";
    fitRationale = "Candidate invented economics not present in evidence.";
  } else if (controlConflict) {
    status = "CONTROL_CONFLICT";
    fitRationale = "Candidate bypasses a mandatory human control.";
  } else if (
    input.remediationRequirements?.length &&
    automationFamily(candidate.strategyFamily) &&
    candidate.strategyFamily !== "HUMAN_IN_THE_LOOP_AUTOMATION"
  ) {
    status = "BLOCKED_BY_REMEDIATION";
    fitRationale = "Remediation must be completed before automation is considered.";
  } else if (
    input.economicState.state === "NOT_JUSTIFIED" &&
    automationFamily(candidate.strategyFamily)
  ) {
    status = "ECONOMICALLY_WEAK";
    fitRationale = "Existing economic state does not justify automation investment.";
  } else if (unsupportedCapability) {
    status = "NEEDS_MORE_EVIDENCE";
    fitRationale = "System capability is not evidenced.";
    discoveryTargets.push({
      targetSource: "IT_INTERVIEW",
      reason: "Confirm whether required system capability exists",
      evidenceNeeded: unsupportedCapability,
      relatedCandidateId: candidate.candidateId,
    });
  }
  return deepFreeze({
    candidateId: candidate.candidateId,
    strategyFamily: candidate.strategyFamily,
    title: candidate.title,
    fitRationale,
    evidenceState: evidenceState(candidate, input),
    prerequisites: candidate.prerequisites,
    riskControlCompatibility: controlConflict
      ? "CONFLICT"
      : candidate.preservedHumanControls.length || !input.controlRequirements.length
        ? "COMPATIBLE"
        : "CONDITIONAL",
    economicState: input.economicState.state,
    unknowns: candidate.unknowns,
    status,
    discoveryTargets,
  });
}

function candidate(input: SolutionStrategyCandidate): SolutionStrategyCandidate {
  return deepFreeze({
    ...input,
    prerequisites: unique(input.prerequisites),
    preservedHumanControls: unique(input.preservedHumanControls),
    requiredSystems: unique(input.requiredSystems),
    requiredData: unique(input.requiredData),
    economicDependencyRefs: unique(input.economicDependencyRefs),
    evidenceRefs: unique(input.evidenceRefs),
    processNodeRefs: unique(input.processNodeRefs),
    keyAssumptions: unique(input.keyAssumptions),
    unknowns: unique(input.unknowns),
    advantages: unique(input.advantages),
    tradeoffs: unique(input.tradeoffs),
    failureModes: unique(input.failureModes),
    providerMetadata: Object.freeze({ ...input.providerMetadata }),
  });
}

function validateInput(input: SolutionStrategyInput): void {
  if (!input.tenantId || !input.companyId || !input.brainRunId || !input.problem.trim())
    throw new Error("Strategy generation scope and problem are required");
  for (const evidence of input.evidence) {
    if (evidence.tenantId && evidence.tenantId !== input.tenantId)
      throw new Error("Cross-tenant evidence cannot enter strategy generation");
    if (evidence.companyId && evidence.companyId !== input.companyId)
      throw new Error("Cross-company evidence cannot enter strategy generation");
  }
  for (const hypothesis of input.retainedHypotheses ?? []) {
    if (
      hypothesis.sourceScope.tenantId !== input.tenantId ||
      hypothesis.sourceScope.companyId !== input.companyId
    )
      throw new Error("Cross-company hypothesis cannot enter strategy generation");
  }
}

function boundedSource(input: SolutionStrategyInput): string {
  return [
    `Problem: ${input.problem}`,
    `Root cause/hypothesis: ${input.rootCauseOrHypothesis}`,
    `Bottleneck: ${input.bottleneck ?? "unknown"}`,
    `Critical issue: ${input.criticalIssue ?? "unknown"}`,
    `Remediation: ${(input.remediationRequirements ?? []).join("; ") || "none"}`,
    `Do not automate: ${(input.doNotAutomateConstraints ?? []).join("; ") || "none"}`,
    `Economic state: ${input.economicState.state}`,
    `Systems: ${input.systemsContext.map((system) => system.name).join(", ") || "unknown"}`,
    `Controls: ${input.controlRequirements.map((control) => control.description).join("; ") || "none"}`,
  ]
    .join("\n")
    .slice(0, 6000);
}

function dedupe(candidates: readonly SolutionStrategyCandidate[]): {
  readonly candidates: readonly SolutionStrategyCandidate[];
  readonly rejected: readonly {
    readonly candidateId: string;
    readonly reason: "DUPLICATE" | "UNSUPPORTED_FAMILY" | SolutionStrategyValidationStatus;
    readonly detail: string;
  }[];
  readonly duplicatesRemoved: number;
} {
  const seen = new Set<string>();
  const kept: SolutionStrategyCandidate[] = [];
  const rejected: { candidateId: string; reason: "DUPLICATE"; detail: string }[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.noveltyKey)) {
      rejected.push({
        candidateId: candidate.candidateId,
        reason: "DUPLICATE",
        detail: "Duplicate novelty key",
      });
      continue;
    }
    seen.add(candidate.noveltyKey);
    kept.push(candidate);
  }
  return Object.freeze({
    candidates: Object.freeze(kept),
    rejected: Object.freeze(rejected),
    duplicatesRemoved: rejected.length,
  });
}

function dependenciesFor(
  candidates: readonly SolutionStrategyCandidate[],
): readonly StrategyDependency[] {
  const data = candidates.find((candidate) => candidate.strategyFamily === "DATA_REMEDIATION");
  if (!data) return Object.freeze([]);
  return Object.freeze(
    candidates
      .filter((candidate) => automationFamily(candidate.strategyFamily))
      .map((candidate) => ({
        prerequisiteCandidateId: data.candidateId,
        dependentCandidateId: candidate.candidateId,
        reason:
          "Data remediation should precede automation where data quality is a known root cause",
      })),
  );
}

function metricsFor(
  raw: readonly Partial<SolutionStrategyCandidate>[],
  retained: readonly SolutionStrategyCandidate[],
  rejected: readonly { readonly reason: string }[],
  comparison: readonly StrategyComparisonItem[],
  duplicatesRemoved: number,
): SolutionStrategyGenerationResult["metrics"] {
  return Object.freeze({
    strategiesGenerated: raw.length,
    strategyFamiliesRepresented: new Set(retained.map((candidate) => candidate.strategyFamily))
      .size,
    duplicatesRemoved,
    unsupportedCandidatesRejected: rejected.filter((item) => item.reason === "UNSUPPORTED_FAMILY")
      .length,
    controlConflictsRejected: rejected.filter((item) => item.reason === "CONTROL_CONFLICT").length,
    candidatesRetained: comparison.filter((item) => item.status === "RETAIN_FOR_COMPARISON").length,
    candidatesNeedingEvidence: comparison.filter((item) => item.status === "NEEDS_MORE_EVIDENCE")
      .length,
    remediationFirstCandidates: retained.filter(
      (item) => item.strategyFamily === "DATA_REMEDIATION",
    ).length,
    nonAutomationStrategiesRetained: comparison.filter(
      (item) => !automationFamily(item.strategyFamily) && item.status === "RETAIN_FOR_COMPARISON",
    ).length,
    directBlueprintPublication: 0,
    directSpecificationPublication: 0,
    aiRecommendationAuthority: 0,
    inventedEconomicsAccepted: 0,
    inventedSystemCapabilitiesAccepted: 0,
    controlBypassAccepted: 0,
    crossCompanyLeakage: 0,
  });
}

function containsInventedEconomics(candidate: SolutionStrategyCandidate): boolean {
  const textValue = [
    candidate.title,
    candidate.summary,
    ...candidate.advantages,
    ...candidate.keyAssumptions,
  ].join(" ");
  return /\b(roi|payback|break-even|break even|€|\$|[0-9]+%|[0-9]+x)\b/i.test(textValue);
}

function inventedSystemCapability(
  candidate: SolutionStrategyCandidate,
  input: SolutionStrategyInput,
): string | null {
  if (
    !["API_INTEGRATION", "NATIVE_SYSTEM_AUTOMATION", "NATIVE_SYSTEM_CONFIGURATION"].includes(
      candidate.strategyFamily,
    )
  )
    return null;
  const knownCapabilities = new Set(
    input.systemsContext.flatMap((system) =>
      (system.capabilities ?? []).map((capability) => capability.toLowerCase()),
    ),
  );
  const capabilityTerms = ["api", "native", "workflow", "automation", "ai"];
  for (const required of [
    ...candidate.requiredData,
    ...candidate.prerequisites,
    ...candidate.keyAssumptions,
  ]) {
    const normalized = required.toLowerCase();
    if (
      capabilityTerms.some((term) => normalized.includes(term)) &&
      ![...knownCapabilities].some((capability) => normalized.includes(capability))
    )
      return required;
  }
  return null;
}

function bypassesControl(
  candidate: SolutionStrategyCandidate,
  input: SolutionStrategyInput,
): boolean {
  const mandatoryHuman =
    input.controlRequirements.some(
      (control) => control.mandatory && control.humanApprovalRequired,
    ) || (input.doNotAutomateConstraints ?? []).length > 0;
  if (!mandatoryHuman) return false;
  const textValue = [candidate.title, candidate.summary, ...candidate.advantages]
    .join(" ")
    .toLowerCase();
  const fullAutoApproval =
    /\b(auto[- ]?approve|fully autonomous|remove approval|skip approval|no human approval)\b/.test(
      textValue,
    );
  return (
    fullAutoApproval ||
    (automationFamily(candidate.strategyFamily) && candidate.preservedHumanControls.length === 0)
  );
}

function evidenceState(
  candidate: SolutionStrategyCandidate,
  input: SolutionStrategyInput,
): StrategyComparisonItem["evidenceState"] {
  if (input.economicState.state === "INSUFFICIENT_EVIDENCE" || candidate.unknowns.length)
    return "UNKNOWN";
  const evidence = new Set(input.evidence.map((item) => item.evidenceId));
  if (candidate.evidenceRefs.some((id) => evidence.has(id))) return "SUPPORTED";
  return "PARTIAL";
}

function controls(input: SolutionStrategyInput): readonly string[] {
  return Object.freeze(
    input.controlRequirements
      .filter((control) => control.humanApprovalRequired || control.mandatory)
      .map((control) => control.description),
  );
}

function systems(input: SolutionStrategyInput): readonly string[] {
  return Object.freeze(input.systemsContext.map((system) => system.name));
}

function evidenceRefsFor(input: SolutionStrategyInput): readonly string[] {
  return Object.freeze([
    ...input.evidence.map((item) => item.evidenceId),
    ...(input.opportunity?.supportingEvidenceIds ?? []),
  ]);
}

function processRefsFor(input: SolutionStrategyInput): readonly string[] {
  return Object.freeze([
    ...input.processContext.map((node) => node.nodeId),
    ...(input.opportunity?.processStepIds ?? []),
  ]);
}

function automationFamily(familyValue: SolutionStrategyFamily): boolean {
  return [
    "NATIVE_SYSTEM_AUTOMATION",
    "LOW_CODE_AUTOMATION",
    "API_INTEGRATION",
    "RPA",
    "AI_ASSISTED_WORKFLOW",
    "HUMAN_IN_THE_LOOP_AUTOMATION",
  ].includes(familyValue);
}

function family(value: unknown): SolutionStrategyFamily | undefined {
  const allowed: readonly SolutionStrategyFamily[] = [
    "PROCESS_REDESIGN",
    "DATA_REMEDIATION",
    "CONTROL_IMPROVEMENT",
    "NATIVE_SYSTEM_CONFIGURATION",
    "NATIVE_SYSTEM_AUTOMATION",
    "LOW_CODE_AUTOMATION",
    "API_INTEGRATION",
    "RPA",
    "AI_ASSISTED_WORKFLOW",
    "HUMAN_IN_THE_LOOP_AUTOMATION",
    "OBSERVABILITY_IMPROVEMENT",
    "MANUAL_PROCESS_WITH_BETTER_CONTROL",
    "DO_NOTHING",
    "DEFER",
  ];
  return typeof value === "string" && allowed.includes(value as SolutionStrategyFamily)
    ? (value as SolutionStrategyFamily)
    : undefined;
}

function scale(value: unknown): StrategyCandidateScale {
  return value === "LOW" || value === "MEDIUM" || value === "HIGH" || value === "UNKNOWN"
    ? value
    : "UNKNOWN";
}

function reversibility(value: unknown): StrategyReversibility {
  return value === "LOW" || value === "MEDIUM" || value === "HIGH" || value === "UNKNOWN"
    ? value
    : "UNKNOWN";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return unique(value.filter((item): item is string => typeof item === "string"));
}

function unique(values: readonly string[] = []): readonly string[] {
  return Object.freeze([...new Set(values.map((value) => value.trim()).filter(Boolean))]);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}
