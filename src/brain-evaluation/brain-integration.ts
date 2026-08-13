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
}
export interface IntegratedBrainResult {
  companyId: string;
  scenarioId: string;
  evidenceSummary: { count: number; ids: readonly string[] };
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
    const causes = new CausalReasoner().reason(
      input.process,
      input.claims,
      input.evidence,
      input.unknowns,
    );
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
    const decision = new OpportunityDecisionEngine().decide({
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
      claims: Object.freeze([...input.claims]),
      unknowns: Object.freeze([...input.unknowns]),
      contradictions,
      discoveryReadiness,
      processConclusions: Object.freeze([...observations, ...conclusions]),
      causes,
      bottlenecks,
      dependencies,
      knowledgeMatches,
      opportunities: Object.freeze([candidate]),
      opportunityDecisions: Object.freeze([{ opportunityId: candidate.opportunityId, decision }]),
      economicEvaluation,
      reasoningTraces: Object.freeze(causes.map((c) => c.trace)),
      blockingIssues: Object.freeze(blockingIssues),
      remainingUncertainty: Math.min(1, input.unknowns.length * 0.2 + contradictions.length * 0.3),
      integrationScorecard: Object.freeze(scorecard),
    });
  }
}
