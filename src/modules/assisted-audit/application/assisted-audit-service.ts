import { AssistedAuditError } from "./assisted-audit-errors";
import type {
  AssistedAuditAction,
  AssistedAuditArtifactReference,
  AssistedAuditReadModel,
  AssistedAuditStage,
  AssistedAuditStageStatus,
  AssistedAuditStageView,
} from "./assisted-audit-model";
import type {
  AssistedAuditRecord,
  AssistedAuditRepositoryPort,
  AssistedAuditRole,
  AssistedAuditState,
} from "./assisted-audit-port";

const labels: Record<AssistedAuditStage, string> = {
  DISCOVERY: "Company Information",
  INTERVIEW: "Interview",
  KNOWLEDGE: "Knowledge",
  PROCESS_MAP: "Processes",
  BUSINESS_ANALYSIS: "Analysis",
  AI_OPPORTUNITIES: "AI Opportunities",
  AUTOMATION_OPPORTUNITIES: "Automation Opportunities",
  ROI: "ROI",
  RECOMMENDATIONS: "Action Plan",
  COMPLETED: "Results",
};

export class AssistedAuditService {
  constructor(
    private readonly repository: AssistedAuditRepositoryPort,
    private readonly userId: string,
  ) {}

  async get(companyId: string): Promise<AssistedAuditReadModel> {
    const state = await this.repository.read(this.userId, companyId);
    if (!state)
      throw new AssistedAuditError(
        "COMPANY_NOT_FOUND",
        "Company was not found in the authenticated tenant",
        404,
      );

    const stages = deriveStages(state);
    const current = stages.find((stage) => stage.status !== "COMPLETED") ?? stages.at(-1)!;
    return {
      company: state.company,
      overallStatus: current.status,
      currentStage: current.stage,
      stages,
      nextAction: current.availableActions[0] ?? null,
      blockingReason: current.blockingReason,
    };
  }
}

function deriveStages(state: AssistedAuditState): AssistedAuditStageView[] {
  const stages: AssistedAuditStageView[] = [];
  const discovery = lifecycleStage(
    "DISCOVERY",
    state.discovery,
    {
      draft: "START_DISCOVERY",
      in_progress: "CONTINUE_DISCOVERY",
      completed: "VALIDATE_DISCOVERY",
    },
    "START_DISCOVERY",
    state.role,
  );
  stages.push(discovery);
  if (!isComplete(discovery)) return blockedRemainder(stages, "Complete Company Information first");

  const interview = lifecycleStage(
    "INTERVIEW",
    state.interview,
    {
      draft: "START_INTERVIEW",
      in_progress: "CONTINUE_INTERVIEW",
      completed: "VALIDATE_INTERVIEW",
    },
    "START_INTERVIEW",
    state.role,
  );
  stages.push(interview);
  if (!isComplete(interview))
    return blockedRemainder(stages, "Complete and validate the Interview first");

  const knowledge = simpleReadyStage(
    "KNOWLEDGE",
    state.knowledge,
    "ready",
    "BUILD_KNOWLEDGE",
    state.role,
  );
  stages.push(knowledge);
  if (!isComplete(knowledge)) return blockedRemainder(stages, "Build Knowledge first");

  const maps = canonicalProcessMaps(state.processMaps, state.selectedProcessMapId);
  if (maps.length > 1) {
    stages.push({
      stage: "PROCESS_MAP",
      label: labels.PROCESS_MAP,
      status: "AMBIGUOUS",
      artifact: null,
      candidateArtifacts: maps.map(reference),
      availableActions: allowed(state.role, "SELECT_PROCESS_MAP"),
      blockingReason: "Select the process map to continue with",
    });
    return blockedRemainder(stages, "A process map selection is required");
  }
  const processMap = versionedStage(
    "PROCESS_MAP",
    maps[0] ?? null,
    "BUILD_PROCESS_MAP",
    "VALIDATE_PROCESS_MAP",
    "PUBLISH_PROCESS_MAP",
    state.role,
  );
  stages.push(processMap);
  if (!isComplete(processMap))
    return blockedRemainder(stages, "Publish the selected Process Map first");

  const analysis = versionedStage(
    "BUSINESS_ANALYSIS",
    state.analysis,
    "GENERATE_ANALYSIS",
    "VALIDATE_ANALYSIS",
    "PUBLISH_ANALYSIS",
    state.role,
  );
  stages.push(analysis);
  if (!isComplete(analysis)) return blockedRemainder(stages, "Publish the Analysis first");

  const ai = versionedStage(
    "AI_OPPORTUNITIES",
    state.aiOpportunities,
    "GENERATE_AI_OPPORTUNITIES",
    "VALIDATE_AI_OPPORTUNITIES",
    "PUBLISH_AI_OPPORTUNITIES",
    state.role,
  );
  stages.push(ai);
  if (!isComplete(ai)) return blockedRemainder(stages, "Publish AI Opportunities first");

  const automation = versionedStage(
    "AUTOMATION_OPPORTUNITIES",
    state.automationOpportunities,
    "GENERATE_AUTOMATION_OPPORTUNITIES",
    "VALIDATE_AUTOMATION_OPPORTUNITIES",
    "PUBLISH_AUTOMATION_OPPORTUNITIES",
    state.role,
  );
  stages.push(automation);
  if (!isComplete(automation))
    return blockedRemainder(stages, "Publish Automation Opportunities first");

  const roi =
    state.roi?.status === "draft" && state.roi.incomplete
      ? active(
          "ROI",
          "IN_PROGRESS",
          state.roi,
          "ENTER_ROI_ASSUMPTIONS",
          state.role,
          "Some ROI assumptions still need to be confirmed",
        )
      : versionedStage(
          "ROI",
          state.roi,
          "ENTER_ROI_ASSUMPTIONS",
          "VALIDATE_ROI",
          "PUBLISH_ROI",
          state.role,
        );
  stages.push(roi);
  if (!isComplete(roi)) return blockedRemainder(stages, "Publish the ROI first");

  const recommendations = versionedStage(
    "RECOMMENDATIONS",
    state.recommendations,
    "GENERATE_RECOMMENDATIONS",
    "VALIDATE_RECOMMENDATIONS",
    "PUBLISH_RECOMMENDATIONS",
    state.role,
  );
  stages.push(recommendations);
  if (!isComplete(recommendations))
    return blockedRemainder(stages, "Publish the Action Plan first");

  stages.push({
    stage: "COMPLETED",
    label: labels.COMPLETED,
    status: "COMPLETED",
    artifact: reference(state.recommendations!),
    candidateArtifacts: [],
    availableActions: ["VIEW_RESULTS"],
    blockingReason: null,
  });
  return stages;
}

function lifecycleStage(
  stage: AssistedAuditStage,
  record: AssistedAuditRecord | null,
  actions: Partial<Record<string, AssistedAuditAction>>,
  startAction: AssistedAuditAction,
  role: AssistedAuditRole,
): AssistedAuditStageView {
  if (!record) return active(stage, "NOT_STARTED", null, startAction, role);
  if (record.status === "validated") return complete(stage, record);
  const action = actions[record.status];
  const status: AssistedAuditStageStatus =
    record.status === "completed" ? "READY_FOR_REVIEW" : "IN_PROGRESS";
  return action
    ? active(stage, status, record, action, role)
    : blocked(stage, record, "The source lifecycle state is not usable for this audit");
}

function simpleReadyStage(
  stage: AssistedAuditStage,
  record: AssistedAuditRecord | null,
  readyStatus: string,
  action: AssistedAuditAction,
  role: AssistedAuditRole,
): AssistedAuditStageView {
  if (!record) return active(stage, "NOT_STARTED", null, action, role);
  if (record.status === readyStatus) return complete(stage, record);
  if (record.status === "building")
    return active(stage, "IN_PROGRESS", record, action, role, "Knowledge is being built");
  return active(stage, "BLOCKED", record, action, role, "The Knowledge build must be retried");
}

function versionedStage(
  stage: AssistedAuditStage,
  record: AssistedAuditRecord | null,
  build: AssistedAuditAction,
  validate: AssistedAuditAction,
  publish: AssistedAuditAction,
  role: AssistedAuditRole,
): AssistedAuditStageView {
  if (!record) return active(stage, "NOT_STARTED", null, build, role);
  if (record.status === "published") return complete(stage, record);
  if (record.status === "draft") return active(stage, "READY_FOR_REVIEW", record, validate, role);
  if (record.status === "validated")
    return active(stage, "READY_TO_PUBLISH", record, publish, role);
  return blocked(stage, record, "The artifact lifecycle state is not usable for this audit");
}

function canonicalProcessMaps(
  records: AssistedAuditRecord[],
  selectedProcessMapId: string | null,
): AssistedAuditRecord[] {
  const byLineage = new Map<string, AssistedAuditRecord>();
  for (const record of records) {
    const key = record.lineageKey ?? record.id;
    const current = byLineage.get(key);
    if (!current || record.version > current.version) byLineage.set(key, record);
  }
  const canonical = [...byLineage.values()].sort((left, right) => left.id.localeCompare(right.id));
  if (!selectedProcessMapId) return canonical;
  const selected = canonical.find((record) => record.id === selectedProcessMapId);
  return selected ? [selected] : canonical;
}

function active(
  stage: AssistedAuditStage,
  status: AssistedAuditStageStatus,
  record: AssistedAuditRecord | null,
  action: AssistedAuditAction,
  role: AssistedAuditRole,
  reason: string | null = null,
): AssistedAuditStageView {
  const actions = allowed(role, action);
  return {
    stage,
    label: labels[stage],
    status,
    artifact: record ? reference(record) : null,
    candidateArtifacts: [],
    availableActions: actions,
    blockingReason: actions.length ? reason : permissionReason(role, action),
  };
}

function complete(stage: AssistedAuditStage, record: AssistedAuditRecord): AssistedAuditStageView {
  return {
    stage,
    label: labels[stage],
    status: "COMPLETED",
    artifact: reference(record),
    candidateArtifacts: [],
    availableActions: [],
    blockingReason: null,
  };
}

function blocked(
  stage: AssistedAuditStage,
  record: AssistedAuditRecord | null,
  reason: string,
): AssistedAuditStageView {
  return {
    stage,
    label: labels[stage],
    status: "BLOCKED",
    artifact: record ? reference(record) : null,
    candidateArtifacts: [],
    availableActions: [],
    blockingReason: reason,
  };
}

function blockedRemainder(
  stages: AssistedAuditStageView[],
  reason: string,
): AssistedAuditStageView[] {
  const present = new Set(stages.map((stage) => stage.stage));
  for (const stage of Object.keys(labels) as AssistedAuditStage[])
    if (!present.has(stage)) stages.push(blocked(stage, null, reason));
  return stages;
}

function allowed(role: AssistedAuditRole, action: AssistedAuditAction): AssistedAuditAction[] {
  if (role === "viewer") return [];
  if (role === "consultant" && (action === "VALIDATE_INTERVIEW" || action.startsWith("PUBLISH_")))
    return [];
  return [action];
}

function permissionReason(role: AssistedAuditRole, action: AssistedAuditAction): string {
  if (role === "viewer") return "This role has read-only access";
  if (role === "consultant" && action === "VALIDATE_INTERVIEW")
    return "An owner or admin must validate the Interview";
  return "An owner or admin must publish this artifact";
}

function reference(record: AssistedAuditRecord): AssistedAuditArtifactReference {
  return {
    id: record.id,
    version: record.version,
    status: record.status,
    ...(record.lockVersion === undefined ? {} : { lockVersion: record.lockVersion }),
  };
}

function isComplete(stage: AssistedAuditStageView): boolean {
  return stage.status === "COMPLETED";
}
