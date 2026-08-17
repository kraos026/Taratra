import {
  Claim,
  Evidence,
  UnknownInformation,
  type Contradiction,
  ReasoningTrace,
} from "./brain-contracts";
import { ContradictionDetector } from "./uncertainty-engine";
import {
  InformationGapDetector,
  type BrainDiscoveryState,
  type DiscoveryReadiness,
} from "./adaptive-discovery";
import {
  ProcessModel,
  ProcessObservationService,
  CausalReasoner,
  BottleneckDetector,
  RootCauseSelector,
  HandoffAnalyzer,
  ReworkAnalyzer,
  ProcessDependencyGraph,
  FailureModeAnalyzer,
  type ProcessConclusion,
  type ProcessObservation,
  type FailureMode,
  type CauseCandidate,
  type Bottleneck,
} from "./process-causal";
import {
  KnowledgeMatcher,
  type KnowledgeContext,
  type PatternMatchResult,
} from "./knowledge-foundation";
import {
  OpportunityCandidate,
  AutomationSuitabilityAssessment,
  TechnicalFeasibilityAssessment,
  ProcessReadinessAssessment,
  DataReadinessAssessment,
  HumanControlAssessment,
  OpportunityRiskAssessment,
  OpportunityEvidenceGuard,
  OpportunityDecisionEngine,
  type OpportunityActionCard,
  type OpportunityPriorityAction,
  type OpportunityStatus,
} from "./opportunity-intelligence";
import {
  BaselineEconomicModel,
  TransformationCostModel,
  BenefitModel,
  EconomicEvaluation,
  EconomicEvidenceGuard,
  type EconomicInput,
  type Evaluation,
} from "./economic-intelligence";
import { CriticalIssueDetector, type CriticalIssue } from "./critical-issues";
import {
  DataQualityDecisionGuard,
  DecisionRobustnessGuard,
  type DataQualityDecisionResult,
} from "./decision-robustness";

export interface BrainIntegrationInput {
  companyId: string;
  scenarioId: string;
  subject: string;
  evidence: readonly Evidence[];
  claims: readonly Claim[];
  unknowns: readonly UnknownInformation[];
  process: ProcessModel;
  knowledge: KnowledgeContext;
  economicInputs: Record<string, EconomicInput>;
  facts: readonly string[];
  contradictionAssumptions?: readonly Evidence[];
  processReadiness?: {
    ownership: number;
    definition: number;
    variation: number;
    rootCause: number;
    dataQuality: number;
    contradiction: number;
    exceptions: number;
    controls: number;
  };
  dataReadiness?: {
    availability: number;
    completeness: number;
    consistency: number;
    structure: number;
    freshness: number;
    sourceOfTruth: number;
    accessibility: number;
    traceability: number;
  };
  feasibility?: {
    requiredCapabilities: readonly string[];
    knownCapabilities: readonly string[];
    integrationAvailable: number;
    apiWrite: number;
    dataAccessible: number;
    authentication: number;
    trigger: number;
    batch: number;
    humanApproval: number;
    observability: number;
  };
  dataQualityDetails?: {
    missingRequiredFields?: readonly string[];
    duplicateRate?: number;
    invalidValueCount?: number;
    inconsistentIdentifierCount?: number;
    staleDataRate?: number;
    masterDataFragmentation?: number;
    reconciliationFailures?: number;
    unknownSourceReliability?: boolean;
    criticalSchemaMismatch?: boolean;
  };
  strategicControlBenefit?: boolean;
}
export interface IntegratedBrainResult {
  companyId: string;
  scenarioId: string;
  evidenceSummary: { count: number; ids: readonly string[] };
  evidence: readonly Evidence[];
  claims: readonly Claim[];
  unknowns: readonly UnknownInformation[];
  contradictions: readonly Contradiction[];
  discoveryReadiness: DiscoveryReadiness;
  processConclusions: readonly (ProcessConclusion | ProcessObservation | FailureMode)[];
  causes: readonly CauseCandidate[];
  bottlenecks: readonly Bottleneck[];
  dependencies: ProcessDependencyGraph;
  knowledgeMatches: readonly PatternMatchResult[];
  opportunities: readonly OpportunityCandidate[];
  opportunityDecisions: readonly {
    opportunityId: string;
    decision: ReturnType<OpportunityDecisionEngine["decide"]>;
  }[];
  economicEvaluation: Evaluation;
  reasoningTraces: readonly ReasoningTrace[];
  blockingIssues: readonly string[];
  remainingUncertainty: number;
  integrationScorecard: Readonly<Record<string, number>>;
  criticalIssues: readonly CriticalIssue[];
  dataQualityDecision: DataQualityDecisionResult;
  decisionRobustness: ReturnType<DecisionRobustnessGuard["evaluate"]>;
  opportunityActions: readonly OpportunityActionCard[];
}

export class BrainIntegrationPipeline {
  run(input: BrainIntegrationInput): IntegratedBrainResult {
    const detector = new ContradictionDetector();
    const contradictions = detector.detect({
      subject: input.subject,
      claims: input.claims,
      evidence: input.evidence,
      assumptions: input.contradictionAssumptions,
      detectedAt: new Date("2026-01-01T00:00:00Z"),
    });
    const gaps = new InformationGapDetector().detect({
      evidence: input.evidence,
      claims: input.claims,
      unknowns: input.unknowns,
      contradictions,
      clarifications: [],
      decisionDependencies: [],
      budget: {
        maximumQuestions: 10,
        maximumQuestionsPerDomain: 5,
        minimumValueThreshold: 0.1,
        alreadyAskedQuestionIds: [],
        questionsAskedByDomain: {},
      },
    } as BrainDiscoveryState);
    const discoveryReadiness: DiscoveryReadiness = {
      outcome: gaps.length ? "BLOCKED_BY_CRITICAL_GAPS" : "READY_FOR_ANALYSIS",
      rationale: gaps.length ? "Blocking information gaps remain" : "No blocking information gaps",
      blockingGapIds: gaps.filter((g) => g.urgency === "CRITICAL").map((g) => g.gapId),
      declaredUncertaintyGapIds: gaps.filter((g) => g.urgency !== "CRITICAL").map((g) => g.gapId),
    };
    const observations = new ProcessObservationService().observe(input.process, input.evidence);
    const rawCauses = new CausalReasoner().reason(
      input.process,
      input.claims,
      input.evidence,
      input.unknowns,
    );
    const selection = new RootCauseSelector().select(
      rawCauses,
      contradictions.length,
      input.unknowns.length,
    );
    const unresolvedRootHypothesis = selection.unresolvedCandidates.find(
      (cause) => cause.semanticKey?.startsWith("cause:") && cause.confidence >= 0.6,
    );
    const causes = Object.freeze([
      ...selection.selectedRootCauses,
      ...(unresolvedRootHypothesis ? [{ ...unresolvedRootHypothesis, kind: "ROOT" as const }] : []),
      ...selection.contributingCauses,
      ...selection.unresolvedCandidates.filter(
        (cause) => cause.causeId !== unresolvedRootHypothesis?.causeId,
      ),
    ]);
    const bottlenecks = new BottleneckDetector().detect(input.process);
    const conclusions = [
      ...new HandoffAnalyzer().analyze(input.process),
      ...new ReworkAnalyzer().analyze(input.process),
      ...new FailureModeAnalyzer().analyze(input.process),
    ];
    const dependencies = new ProcessDependencyGraph(input.process);
    const matcher = new KnowledgeMatcher();
    const knowledgeMatches = input.knowledge.relevantPatterns.map((p) =>
      matcher.match(p, { facts: input.facts, evidence: input.evidence }),
    );
    const processReadiness = new ProcessReadinessAssessment().assess(
      input.processReadiness ?? {
        ownership: 1,
        definition: 1,
        variation: 0,
        rootCause: causes.length ? 1 : 0,
        dataQuality: 1,
        contradiction: contradictions.length ? 1 : 0,
        exceptions: 0,
        controls: 1,
      },
    );
    const dataReadiness = new DataReadinessAssessment().assess(
      input.dataReadiness ?? {
        availability: 1,
        completeness: 1,
        consistency: 1,
        structure: 1,
        freshness: 1,
        sourceOfTruth: 1,
        accessibility: 1,
        traceability: 1,
      },
    );
    const dataQualityDecision = new DataQualityDecisionGuard().assess({
      score: dataReadiness.score,
      ...(input.dataQualityDetails ?? {}),
    });
    const feasibility = new TechnicalFeasibilityAssessment().assess(
      input.feasibility ?? {
        requiredCapabilities: [],
        knownCapabilities: [],
        integrationAvailable: 0,
        dataAccessible: 0,
        apiWrite: 0,
        authentication: 0,
        trigger: 0,
        batch: 0,
        humanApproval: 0,
        observability: 0,
      },
    );
    const candidate = OpportunityCandidate.create({
      opportunityId: `opportunity:${input.scenarioId}`,
      subject: input.subject,
      problemStatement: causes[0]?.statement ?? input.subject,
      targetOutcome: "Improve process outcome",
      currentState: "Observed process state",
      desiredState: "Controlled improved state",
      candidateType: "AUTOMATION",
      confidence: input.claims.length
        ? Math.max(...input.claims.map((c) => c.confidence.value))
        : 0,
      supportingClaimIds: input.claims.map((c) => c.claimId),
      supportingEvidenceIds: input.evidence.map((e) => e.evidenceId),
      causeIds: causes.map((c) => c.causeId),
      processStepIds: input.process.process.steps.map((s) => s.stepId),
      trace:
        causes[0]?.trace ?? ReasoningTrace.create({ opportunity: "Opportunity candidate" }, []),
      valueSignals: {
        frequency: input.economicInputs.frequency?.value ?? undefined,
        volume: input.economicInputs.volume?.value ?? undefined,
        timeConsumed: input.economicInputs.currentLaborTime?.value ?? undefined,
      },
    });
    const suitability = new AutomationSuitabilityAssessment().assess(candidate.valueSignals, {
      ruleClarity: 0.7,
      inputStructure: 0.7,
      outputStructure: 0.7,
      exceptionRate: input.process.process.steps[0]?.exceptionFrequency ?? 0,
      decisionComplexity: 0,
      humanJudgmentDependency: 0,
      dataAvailability: dataReadiness.score,
      processStability: processReadiness.score,
      integrationAvailability: feasibility.score,
      controlRequirements: 0,
      currentManualEffort: input.economicInputs.currentLaborTime?.value ?? 0,
    });
    const human = new HumanControlAssessment().assess({
      intentional: input.process.controls.some((c) => c.intentional),
      required: input.process.controls.some((c) => c.requiredHuman),
      judgment: 0,
      duplicate: false,
    });
    const risk = new OpportunityRiskAssessment().assess({
      operationalRisk: 0.2,
      dataRisk: 1 - dataReadiness.score,
      securityRisk: 0.1,
      complianceRisk: 0,
      financialRisk: 0.2,
      vendorDependencyRisk: 1 - feasibility.score,
      changeManagementRisk: 0.2,
      failureImpact: 0.2,
      reversibility: 0.8,
    });
    const evidenceGuard = new OpportunityEvidenceGuard().assess({
      criticalEvidenceMissing: !input.evidence.length,
      rootCauseUncertain: !causes.length,
      materialContradiction: contradictions.length > 0,
      feasibility: feasibility.status,
      capabilityUnknown: feasibility.status === "UNKNOWN",
      dataReadiness: input.unknowns.length ? "UNKNOWN" : dataReadiness.status,
    });
    const baselineDecision = new OpportunityDecisionEngine().decide({
      candidateType: candidate.candidateType,
      suitability,
      feasibility,
      process: processReadiness,
      data: dataReadiness,
      risk,
      evidence: evidenceGuard,
      human: human.kind,
      value: 0.8,
    });
    new BaselineEconomicModel().calculate(input.economicInputs);
    const cost = new TransformationCostModel().calculate(input.economicInputs);
    const benefit = new BenefitModel().calculate(input.economicInputs);
    const economicEvaluation = new EconomicEvaluation().evaluate(
      benefit,
      cost,
      Math.min(candidate.confidence, 1 - input.unknowns.length * 0.2),
      new EconomicEvidenceGuard().assess(
        Object.values(input.economicInputs),
        contradictions.length > 0,
      ).status === "SUFFICIENT"
        ? []
        : ["economic evidence"],
    );
    const decisionRobustness = new DecisionRobustnessGuard().evaluate({
      dataQuality: dataQualityDecision,
      economicSignal: economicEvaluation.signal,
      economicInputs: Object.values(input.economicInputs),
      contradictions,
      evidence: input.evidence,
      unknowns: input.unknowns,
      strategicControlBenefit: input.strategicControlBenefit,
    });
    const decision =
      decisionRobustness.decision === "ALLOW"
        ? baselineDecision
        : decisionRobustness.decision === "REJECT"
          ? {
              decision: "REJECT" as const,
              reasons: ["LOW_MANUAL_COST" as const],
              rationale: decisionRobustness.rationale,
            }
          : decisionRobustness.decision === "DEFER"
            ? {
                decision: "DEFER" as const,
                reasons: ["CHANGE_COST_TOO_HIGH" as const],
                rationale: decisionRobustness.rationale,
              }
            : decisionRobustness.decision === "REMEDIATE_FIRST"
              ? {
                  decision: "DEFER" as const,
                  reasons: ["DATA_NOT_READY" as const],
                  rationale: decisionRobustness.rationale,
                }
              : {
                  decision: "NEED_MORE_EVIDENCE" as const,
                  reasons: ["INSUFFICIENT_EVIDENCE" as const],
                  rationale: decisionRobustness.rationale,
                };
    const status: OpportunityStatus =
      decisionRobustness.decision === "ALLOW"
        ? decision.decision === "RECOMMEND_CANDIDATE"
          ? "RECOMMENDED"
          : "QUALIFIED"
        : decisionRobustness.decision === "REJECT"
          ? "REJECTED"
          : decisionRobustness.decision === "DEFER"
            ? "DEFERRED"
            : decisionRobustness.decision === "REMEDIATE_FIRST"
              ? "REMEDIATION_REQUIRED"
              : decisionRobustness.contradictionResolution.some(
                    (resolution) => resolution.state === "UNRESOLVED_MATERIAL",
                  )
                ? "UNDER_INVESTIGATION"
                : decisionRobustness.economicallyUncertain
                  ? "ECONOMICALLY_UNQUALIFIED"
                  : "UNDER_INVESTIGATION";
    const action: OpportunityPriorityAction =
      decisionRobustness.decision === "ALLOW" && decision.decision === "RECOMMEND_CANDIDATE"
        ? "RECOMMEND_NOW"
        : decisionRobustness.decision === "REMEDIATE_FIRST"
          ? "REMEDIATE_FIRST"
          : decisionRobustness.decision === "REJECT"
            ? "DO_NOT_AUTOMATE"
            : decisionRobustness.decision === "DEFER"
              ? "DEFER"
              : "INVESTIGATE";
    const qualifiedCandidate = OpportunityCandidate.create({
      ...candidate,
      status,
      prerequisites: [
        ...candidate.prerequisites,
        ...dataQualityDecision.requiredDataRemediation.map((description, index) => ({
          id: `data-remediation:${index + 1}`,
          description,
          reason: "Data quality prerequisite",
          blocking: true,
        })),
      ],
    });
    const requiredEvidence = Object.freeze([
      ...decisionRobustness.reasons.filter((reason) => reason.includes("economic")),
      ...decisionRobustness.contradictionResolution.flatMap(
        (resolution) => resolution.evidenceNeeded,
      ),
      ...dataQualityDecision.evidenceNeeded,
    ]);
    const opportunityActions: readonly OpportunityActionCard[] = Object.freeze([
      Object.freeze({
        opportunityId: qualifiedCandidate.opportunityId,
        title: qualifiedCandidate.subject,
        problem: qualifiedCandidate.problemStatement,
        rootCause:
          causes.find((cause) => cause.kind === "ROOT")?.statement ??
          "Root cause under investigation",
        potentialImpact: Object.freeze({
          volume: qualifiedCandidate.valueSignals.volume ?? null,
          timeConsumed: qualifiedCandidate.valueSignals.timeConsumed ?? null,
        }),
        status,
        action,
        whyDetected: "Observed process evidence supports a candidate",
        whyNotRecommended: action === "RECOMMEND_NOW" ? null : decisionRobustness.rationale,
        requiredEvidence,
        prerequisites: qualifiedCandidate.prerequisites,
        nextBestAction:
          action === "REMEDIATE_FIRST"
            ? "Complete data remediation and re-evaluate"
            : action === "DO_NOT_AUTOMATE"
              ? "Retain the current process or redesign it without automation"
              : action === "RECOMMEND_NOW"
                ? "Proceed to controlled qualification"
                : "Collect the required evidence and re-evaluate",
        confidence: qualifiedCandidate.confidence,
        trace: qualifiedCandidate.trace,
      }),
    ]);
    const criticalIssues = new CriticalIssueDetector().detect({
      causes,
      bottlenecks,
      unknowns: input.unknowns,
      contradictions,
      mandatoryControlSubjects: input.process.controls
        .filter((control) => control.requiredHuman)
        .map((control) => control.stepId),
      negativeEconomics: economicEvaluation.signal === "NEGATIVE_VALUE",
    });
    const blockingIssues = [
      ...gaps.filter((g) => g.urgency === "CRITICAL").map((g) => g.gapId),
      ...decision.reasons,
    ];
    const traceComplete = candidate.supportingEvidenceIds.every((id) =>
      input.evidence.some((e) => e.evidenceId === id),
    );
    const scorecard = {
      evidenceTraceCompleteness: traceComplete ? 1 : 0,
      uncertaintyPreservation: contradictions.length ? 1 : 0,
      causalTraceCompleteness: causes.length ? 1 : 0,
      knowledgeBoundaryIntegrity: knowledgeMatches.every(
        (m) => m.candidateKind !== "HYPOTHESIS" || m.status !== "MATCH",
      )
        ? 1
        : 0,
      opportunityGateIntegrity:
        decision.decision !== "RECOMMEND_CANDIDATE" || evidenceGuard.status === "SUFFICIENT"
          ? 1
          : 0,
      economicTraceCompleteness: economicEvaluation.missingInputs.length ? 0.5 : 1,
      deterministicReproducibility: 1,
    };
    return Object.freeze({
      companyId: input.companyId,
      scenarioId: input.scenarioId,
      evidenceSummary: {
        count: input.evidence.length,
        ids: Object.freeze(input.evidence.map((e) => e.evidenceId)),
      },
      evidence: Object.freeze([...input.evidence]),
      claims: Object.freeze([...input.claims]),
      unknowns: Object.freeze([...input.unknowns]),
      contradictions,
      discoveryReadiness,
      processConclusions: Object.freeze([...observations, ...conclusions]),
      causes,
      bottlenecks,
      dependencies,
      knowledgeMatches,
      opportunities: Object.freeze([qualifiedCandidate]),
      opportunityDecisions: Object.freeze([
        { opportunityId: qualifiedCandidate.opportunityId, decision },
      ]),
      economicEvaluation,
      reasoningTraces: Object.freeze(causes.map((c) => c.trace)),
      blockingIssues: Object.freeze(blockingIssues),
      remainingUncertainty: Math.min(1, input.unknowns.length * 0.2 + contradictions.length * 0.3),
      integrationScorecard: Object.freeze(scorecard),
      criticalIssues,
      dataQualityDecision,
      decisionRobustness,
      opportunityActions,
    });
  }
}
