import type {
  AdaptiveDiscoveryPlan,
  AdaptiveDiscoveryOptions,
  RecommendedDiscoveryAction,
} from "./adaptive-discovery-production-bridge";
import { AdaptiveDiscoveryProductionBridge } from "./adaptive-discovery-production-bridge";
import {
  type ApproveDiscoveryActionCommand,
  type RejectDiscoveryActionCommand,
  type ActionExecutionRecord,
} from "./approved-discovery-action-write-bridge";
import {
  DiscoveryResponseProcessor,
  type DiscoveryResponseProcessingResult,
} from "./discovery-response-processing";
import type { RealCompanyBrainResult } from "./real-company-brain-orchestrator";

export type ClosedLoopStoppingState =
  | "READY_FOR_ANALYSIS"
  | "READY_WITH_DECLARED_UNCERTAINTY"
  | "CONTINUE_DISCOVERY"
  | "BLOCKED_BY_CRITICAL_GAPS"
  | "QUESTION_BUDGET_EXHAUSTED"
  | "HUMAN_ESCALATION_REQUIRED";

export type ClosedLoopStatus = "ACTIVE" | "STOPPED";

export interface DiscoveryLoopState {
  readonly tenantId: string;
  readonly companyId: string;
  readonly loopId: string;
  readonly initialBrainRunId: string;
  readonly currentBrainRunId: string;
  readonly iterationNumber: number;
  readonly materialGapIds: readonly string[];
  readonly resolvedGapIds: readonly string[];
  readonly openGapIds: readonly string[];
  readonly pendingRecommendedActionIds: readonly string[];
  readonly approvedActionIds: readonly string[];
  readonly executedActionIds: readonly string[];
  readonly rejectedActionIds: readonly string[];
  readonly stoppingState: ClosedLoopStoppingState;
  readonly remainingQuestionBudget: number;
  readonly status: ClosedLoopStatus;
}

export interface IterationObservation {
  readonly iterationNumber: number;
  readonly brainRunId: string;
  readonly gapCount: number;
  readonly proposedActionCount: number;
  readonly executedActionCount: number;
  readonly responseCount: number;
  readonly resolvedGaps: readonly string[];
  readonly newContradictions: readonly string[];
  readonly decisionChanges: Readonly<Record<string, boolean>>;
  readonly stoppingState: ClosedLoopStoppingState;
}

export interface ClosedLoopDiscoveryResult {
  readonly loop: DiscoveryLoopState;
  readonly initialBrainResult: RealCompanyBrainResult;
  readonly currentBrainResult: RealCompanyBrainResult;
  readonly currentPlan: AdaptiveDiscoveryPlan;
  readonly materialGapIds: readonly string[];
  readonly resolvedGapIds: readonly string[];
  readonly openGapIds: readonly string[];
  readonly actionsProposed: readonly RecommendedDiscoveryAction[];
  readonly actionsApproved: readonly string[];
  readonly actionsExecuted: readonly string[];
  readonly actionsRejected: readonly string[];
  readonly actionsUnsupported: readonly string[];
  readonly stoppingReason: string;
  readonly remainingQuestionBudget: number;
  readonly nextBestActions: readonly string[];
  readonly observations: readonly IterationObservation[];
  readonly traceability: Readonly<Record<string, readonly string[]>>;
}

export interface ClosedLoopDependencies {
  readonly discovery: Pick<AdaptiveDiscoveryProductionBridge, "plan">;
  readonly writes: {
    approve(command: ApproveDiscoveryActionCommand): Promise<Pick<ActionExecutionRecord, "status">>;
    reject(command: RejectDiscoveryActionCommand): Promise<Pick<ActionExecutionRecord, "status">>;
  };
  readonly responses: Pick<DiscoveryResponseProcessor, "process">;
}

interface InternalLoop {
  state: DiscoveryLoopState;
  initialResult: RealCompanyBrainResult;
  currentResult: RealCompanyBrainResult;
  plan: AdaptiveDiscoveryPlan;
  observations: IterationObservation[];
  rejected: Set<string>;
  approved: Set<string>;
  executed: Set<string>;
  unsupported: Set<string>;
  responses: number;
  noMaterialChangeIterations: number;
}

/** Coordinates F2.1-F2.3 without bypassing human approval or production ownership. */
export class ClosedLoopDiscoveryOrchestrator {
  private readonly loops = new Map<string, InternalLoop>();

  constructor(private readonly dependencies: ClosedLoopDependencies) {}

  async start(input: {
    loopId: string;
    result: RealCompanyBrainResult;
    maximumQuestions?: number;
  }): Promise<ClosedLoopDiscoveryResult> {
    const options: AdaptiveDiscoveryOptions = { maximumQuestions: input.maximumQuestions ?? 10 };
    const plan = await this.dependencies.discovery.plan(input.result, options);
    const filteredPlan = this.filterPlan(plan, new Set());
    const loop = this.createLoop(input.loopId, input.result, filteredPlan);
    this.loops.set(input.loopId, loop);
    return this.result(loop);
  }

  async approve(
    loopId: string,
    command: ApproveDiscoveryActionCommand,
  ): Promise<ClosedLoopDiscoveryResult> {
    const loop = this.requireLoop(loopId);
    this.assertScope(loop, command.tenantId, command.companyId);
    if (loop.state.stoppingState === "QUESTION_BUDGET_EXHAUSTED")
      throw new Error("Question budget is exhausted");
    const execution = await this.dependencies.writes.approve(command);
    loop.approved.add(command.actionId);
    if (execution.status === "EXECUTED") loop.executed.add(command.actionId);
    if (execution.status === "UNSUPPORTED") loop.unsupported.add(command.actionId);
    loop.state = this.updateState(loop, loop.state.iterationNumber);
    return this.result(loop);
  }

  async reject(
    loopId: string,
    command: RejectDiscoveryActionCommand,
  ): Promise<ClosedLoopDiscoveryResult> {
    const loop = this.requireLoop(loopId);
    this.assertScope(loop, command.tenantId, command.companyId);
    await this.dependencies.writes.reject(command);
    loop.rejected.add(command.actionId);
    loop.state = this.updateState(loop, loop.state.iterationNumber);
    return this.result(loop);
  }

  async processResponse(
    loopId: string,
    input: { tenantId: string; companyId: string; productionResponseId: string },
  ): Promise<ClosedLoopDiscoveryResult> {
    const loop = this.requireLoop(loopId);
    this.assertScope(loop, input.tenantId, input.companyId);
    const processed = await this.dependencies.responses.process(input);
    this.applyResponse(loop, processed);
    loop.currentResult = processed.brainResult;
    loop.plan = this.filterPlan(processed.nextDiscoveryPlan, loop.rejected);
    const changed = materiallyChanged(loop.currentResult, processed);
    loop.noMaterialChangeIterations = changed ? 0 : loop.noMaterialChangeIterations + 1;
    loop.state = this.updateState(loop, loop.state.iterationNumber + 1, processed);
    return this.result(loop);
  }

  private createLoop(
    loopId: string,
    result: RealCompanyBrainResult,
    plan: AdaptiveDiscoveryPlan,
  ): InternalLoop {
    const state: DiscoveryLoopState = {
      tenantId: result.tenantId,
      companyId: result.companyId,
      loopId,
      initialBrainRunId: result.brain.scenarioId,
      currentBrainRunId: result.brain.scenarioId,
      iterationNumber: 0,
      materialGapIds: plan.materialGaps.map((gap) => gap.gapId),
      resolvedGapIds: [],
      openGapIds: plan.materialGaps.map((gap) => gap.gapId),
      pendingRecommendedActionIds: plan.recommendedActions.map((action) => action.questionId),
      approvedActionIds: [],
      executedActionIds: [],
      rejectedActionIds: [],
      stoppingState: stoppingState(plan, plan.remainingQuestionBudget),
      remainingQuestionBudget: plan.remainingQuestionBudget,
      status: terminal(plan) ? "STOPPED" : "ACTIVE",
    };
    return {
      state,
      initialResult: result,
      currentResult: result,
      plan,
      observations: [this.observation(state, plan, 0, 0, [], {})],
      rejected: new Set(),
      approved: new Set(),
      executed: new Set(),
      unsupported: new Set(),
      responses: 0,
      noMaterialChangeIterations: 0,
    };
  }

  private applyResponse(loop: InternalLoop, processed: DiscoveryResponseProcessingResult) {
    loop.responses += 1;
    if (processed.actionId) loop.approved.add(processed.actionId);
    if (processed.gapResolution === "RESOLVED") {
      const gap = new Set(loop.state.resolvedGapIds);
      gap.add(processed.gapId);
      loop.state = { ...loop.state, resolvedGapIds: [...gap] };
    }
  }

  private updateState(
    loop: InternalLoop,
    iteration: number,
    processed?: DiscoveryResponseProcessingResult,
  ): DiscoveryLoopState {
    const plan = loop.plan;
    const resolved = new Set(loop.state.resolvedGapIds);
    const open = plan.materialGaps.map((gap) => gap.gapId).filter((id) => !resolved.has(id));
    const stopping = stoppingState(plan, plan.remainingQuestionBudget);
    const state: DiscoveryLoopState = {
      ...loop.state,
      currentBrainRunId: processed?.newBrainRunId ?? loop.state.currentBrainRunId,
      iterationNumber: iteration,
      materialGapIds: plan.materialGaps.map((gap) => gap.gapId),
      resolvedGapIds: [...resolved],
      openGapIds: open,
      pendingRecommendedActionIds: plan.recommendedActions
        .map((action) => action.questionId)
        .filter((id) => !loop.rejected.has(id) && !loop.executed.has(id)),
      approvedActionIds: [...loop.approved],
      executedActionIds: [...loop.executed],
      rejectedActionIds: [...loop.rejected],
      stoppingState: stopping,
      remainingQuestionBudget: plan.remainingQuestionBudget,
      status: terminal(plan) ? "STOPPED" : "ACTIVE",
    };
    const observation = this.observation(
      state,
      plan,
      loop.responses,
      processed?.contradictionsIntroduced.length ?? 0,
      processed?.gapResolution === "RESOLVED" ? [processed.gapId] : [],
      processed?.decisionChanges ?? {},
    );
    loop.observations.push(observation);
    return state;
  }

  private filterPlan(plan: AdaptiveDiscoveryPlan, rejected: Set<string>): AdaptiveDiscoveryPlan {
    const actions = plan.recommendedActions.filter((action) => !rejected.has(action.questionId));
    return Object.freeze({ ...plan, recommendedActions: Object.freeze(actions) });
  }

  private observation(
    state: DiscoveryLoopState,
    plan: AdaptiveDiscoveryPlan,
    responseCount: number,
    contradictionCount: number,
    resolvedGaps: readonly string[],
    decisionChanges: Readonly<Record<string, boolean>>,
  ): IterationObservation {
    return Object.freeze({
      iterationNumber: state.iterationNumber,
      brainRunId: state.currentBrainRunId,
      gapCount: plan.materialGaps.length,
      proposedActionCount: plan.recommendedActions.length,
      executedActionCount: state.executedActionIds.length,
      responseCount,
      resolvedGaps: Object.freeze([...resolvedGaps]),
      newContradictions: Object.freeze(
        Array.from({ length: contradictionCount }, (_, i) => `contradiction:${i + 1}`),
      ),
      decisionChanges,
      stoppingState: state.stoppingState,
    });
  }

  private result(loop: InternalLoop): ClosedLoopDiscoveryResult {
    return Object.freeze({
      loop: loop.state,
      initialBrainResult: loop.initialResult,
      currentBrainResult: loop.currentResult,
      currentPlan: loop.plan,
      materialGapIds: loop.state.materialGapIds,
      resolvedGapIds: loop.state.resolvedGapIds,
      openGapIds: loop.state.openGapIds,
      actionsProposed: loop.plan.recommendedActions.filter(
        (action) => !loop.rejected.has(action.questionId),
      ),
      actionsApproved: [...loop.approved],
      actionsExecuted: [...loop.executed],
      actionsRejected: [...loop.rejected],
      actionsUnsupported: [...loop.unsupported],
      stoppingReason: loop.plan.stoppingReason,
      remainingQuestionBudget: loop.state.remainingQuestionBudget,
      nextBestActions: loop.currentResult.nextBestActions,
      observations: Object.freeze([...loop.observations]),
      traceability: Object.freeze({
        company: [loop.state.companyId],
        tenant: [loop.state.tenantId],
        brainRuns: [loop.state.initialBrainRunId, loop.state.currentBrainRunId],
        gaps: loop.state.materialGapIds,
      }),
    });
  }

  private requireLoop(loopId: string): InternalLoop {
    const loop = this.loops.get(loopId);
    if (!loop) throw new Error("Discovery loop was not found");
    return loop;
  }

  private assertScope(loop: InternalLoop, tenantId: string, companyId: string) {
    if (loop.state.tenantId !== tenantId || loop.state.companyId !== companyId)
      throw new Error("Discovery loop is outside the requested company");
  }
}

function stoppingState(plan: AdaptiveDiscoveryPlan, budget: number): ClosedLoopStoppingState {
  if (budget <= 0 && plan.recommendedActions.length > 0) return "QUESTION_BUDGET_EXHAUSTED";
  return plan.readiness.outcome;
}

function terminal(plan: AdaptiveDiscoveryPlan): boolean {
  return (
    plan.readiness.outcome === "READY_FOR_ANALYSIS" ||
    plan.readiness.outcome === "READY_WITH_DECLARED_UNCERTAINTY" ||
    plan.remainingQuestionBudget <= 0
  );
}

function materiallyChanged(
  result: RealCompanyBrainResult,
  processed: DiscoveryResponseProcessingResult,
): boolean {
  return (
    processed.gapResolution !== "STILL_OPEN" ||
    processed.contradictionsIntroduced.length > 0 ||
    Object.values(processed.decisionChanges).some(Boolean) ||
    result.nextBestActions.length > 0
  );
}
