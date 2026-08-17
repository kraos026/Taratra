import type {
  AdaptiveDiscoveryPlan,
  RecommendedDiscoveryAction,
  QuestionIntent,
  ProductionDiscoveryTarget,
} from "./adaptive-discovery-production-bridge";

export type DiscoveryActionExecutionStatus =
  "PROPOSED" | "APPROVED" | "EXECUTED" | "REJECTED" | "STALE" | "UNSUPPORTED";

export interface ApproveDiscoveryActionCommand {
  readonly tenantId: string;
  readonly companyId: string;
  readonly brainRunId: string;
  readonly actionId: string;
  readonly approvedBy: string;
  readonly editedHumanWording?: string;
  readonly targetParticipantId?: string;
  readonly notes?: string;
}

export interface RejectDiscoveryActionCommand {
  readonly tenantId: string;
  readonly companyId: string;
  readonly brainRunId: string;
  readonly actionId: string;
  readonly rejectedBy: string;
  readonly reasonCode:
    "NOT_RELEVANT" | "ALREADY_KNOWN" | "WRONG_TARGET" | "TOO_COSTLY" | "OUT_OF_SCOPE" | "OTHER";
  readonly note?: string;
}

export interface ActionExecutionRecord {
  readonly executionId: string;
  readonly tenantId: string;
  readonly companyId: string;
  readonly brainRunId: string;
  readonly actionId: string;
  readonly status: DiscoveryActionExecutionStatus;
  readonly originalQuestionIntent: QuestionIntent;
  readonly approvedQuestionText?: string;
  readonly productionReference?: string;
  readonly executedBy?: string;
  readonly rejectionReason?: string;
  readonly notes?: string;
}

export interface CurrentDiscoveryContext {
  readonly brainRunId: string;
  readonly knowledgeSnapshotId?: string;
  readonly processMapId?: string;
}

export interface ApprovedDiscoveryActionPorts {
  loadPlan(
    tenantId: string,
    companyId: string,
    brainRunId: string,
  ): Promise<AdaptiveDiscoveryPlan | null>;
  currentContext(tenantId: string, companyId: string): Promise<CurrentDiscoveryContext>;
  findExecution(executionId: string): Promise<ActionExecutionRecord | null>;
  saveExecution(record: ActionExecutionRecord): Promise<void>;
  /** Existing Interview application-service wrapper. */
  createInterviewQuestion?: (input: {
    tenantId: string;
    companyId: string;
    target: Exclude<
      ProductionDiscoveryTarget,
      "DISCOVERY" | "KNOWLEDGE_DOCUMENT" | "SYSTEM_EVIDENCE" | "PROCESS_EVIDENCE"
    >;
    question: string;
    participantId?: string;
    trace: QuestionIntent["traceability"];
  }) => Promise<{ reference: string }>;
  /** Existing Discovery application-service wrapper. */
  createDiscoveryRequest?: (input: {
    tenantId: string;
    companyId: string;
    question: string;
    trace: QuestionIntent["traceability"];
  }) => Promise<{ reference: string }>;
}

/** Executes only explicitly approved actions against existing production services. */
export class ApprovedDiscoveryActionWriteBridge {
  constructor(private readonly ports: ApprovedDiscoveryActionPorts) {}

  async approve(command: ApproveDiscoveryActionCommand): Promise<ActionExecutionRecord> {
    const plan = await this.ports.loadPlan(command.tenantId, command.companyId, command.brainRunId);
    if (!plan || plan.tenantId !== command.tenantId || plan.companyId !== command.companyId)
      throw new Error("Discovery action is not available in this tenant/company");
    const action = plan.recommendedActions.find(
      (candidate) => candidate.questionId === command.actionId,
    );
    if (!action) throw new Error("Discovery action was not found in the authoritative plan");
    const executionId = `${command.tenantId}:${command.companyId}:${command.brainRunId}:${command.actionId}`;
    const prior = await this.ports.findExecution(executionId);
    if (prior?.status === "EXECUTED" || prior?.status === "REJECTED") return prior;
    const current = await this.ports.currentContext(command.tenantId, command.companyId);
    if (current.brainRunId !== plan.brainRunReference || !sameContext(plan, current))
      return this.persist({
        executionId,
        tenantId: command.tenantId,
        companyId: command.companyId,
        brainRunId: command.brainRunId,
        actionId: command.actionId,
        status: "STALE",
        originalQuestionIntent: action.questionIntent,
      });

    const approvedQuestionText =
      command.editedHumanWording?.trim() ||
      action.naturalWording ||
      action.questionIntent.businessConcept;
    if (!approvedQuestionText) throw new Error("Approved wording is required");
    const result = await this.executeTarget(command, action, approvedQuestionText);
    return this.persist({
      executionId,
      tenantId: command.tenantId,
      companyId: command.companyId,
      brainRunId: command.brainRunId,
      actionId: command.actionId,
      status: result.status,
      originalQuestionIntent: action.questionIntent,
      approvedQuestionText,
      productionReference: result.reference,
      executedBy: command.approvedBy,
      notes: command.notes,
    });
  }

  async reject(command: RejectDiscoveryActionCommand): Promise<ActionExecutionRecord> {
    const plan = await this.ports.loadPlan(command.tenantId, command.companyId, command.brainRunId);
    if (!plan) throw new Error("Discovery action is not available");
    const action = plan.recommendedActions.find(
      (candidate) => candidate.questionId === command.actionId,
    );
    if (!action) throw new Error("Discovery action was not found in the authoritative plan");
    const record: ActionExecutionRecord = {
      executionId: `${command.tenantId}:${command.companyId}:${command.brainRunId}:${command.actionId}`,
      tenantId: command.tenantId,
      companyId: command.companyId,
      brainRunId: command.brainRunId,
      actionId: command.actionId,
      status: "REJECTED",
      originalQuestionIntent: action.questionIntent,
      rejectionReason: command.reasonCode,
      executedBy: command.rejectedBy,
      notes: command.note,
    };
    return this.persist(record);
  }

  private async executeTarget(
    command: ApproveDiscoveryActionCommand,
    action: RecommendedDiscoveryAction,
    question: string,
  ): Promise<{ status: "EXECUTED" | "UNSUPPORTED"; reference?: string }> {
    const trace = action.questionIntent.traceability;
    const target = action.targetSource;
    if (
      target === "OWNER_INTERVIEW" ||
      target === "MANAGER_INTERVIEW" ||
      target === "OPERATOR_INTERVIEW" ||
      target === "FINANCE_INTERVIEW" ||
      target === "IT_INTERVIEW"
    ) {
      if (!this.ports.createInterviewQuestion) return { status: "UNSUPPORTED" };
      const result = await this.ports.createInterviewQuestion({
        tenantId: command.tenantId,
        companyId: command.companyId,
        target,
        question,
        participantId: command.targetParticipantId,
        trace,
      });
      return { status: "EXECUTED", reference: result.reference };
    }
    if (target === "DISCOVERY") {
      if (!this.ports.createDiscoveryRequest) return { status: "UNSUPPORTED" };
      const result = await this.ports.createDiscoveryRequest({
        tenantId: command.tenantId,
        companyId: command.companyId,
        question,
        trace,
      });
      return { status: "EXECUTED", reference: result.reference };
    }
    return { status: "UNSUPPORTED" };
  }

  private async persist(record: ActionExecutionRecord): Promise<ActionExecutionRecord> {
    await this.ports.saveExecution(Object.freeze(record));
    return Object.freeze(record);
  }
}

function sameContext(plan: AdaptiveDiscoveryPlan, current: CurrentDiscoveryContext): boolean {
  return (
    plan.contextReferences.knowledgeSnapshotId === current.knowledgeSnapshotId &&
    plan.contextReferences.processMapId === current.processMapId
  );
}
