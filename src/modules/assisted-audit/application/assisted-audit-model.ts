export const assistedAuditStages = [
  "DISCOVERY",
  "INTERVIEW",
  "KNOWLEDGE",
  "PROCESS_MAP",
  "BUSINESS_ANALYSIS",
  "AI_OPPORTUNITIES",
  "AUTOMATION_OPPORTUNITIES",
  "ROI",
  "RECOMMENDATIONS",
  "COMPLETED",
] as const;

export type AssistedAuditStage = (typeof assistedAuditStages)[number];

export type AssistedAuditStageStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "READY_FOR_REVIEW"
  | "READY_TO_PUBLISH"
  | "COMPLETED"
  | "BLOCKED"
  | "AMBIGUOUS";

export type AssistedAuditAction =
  | "START_DISCOVERY"
  | "CONTINUE_DISCOVERY"
  | "VALIDATE_DISCOVERY"
  | "START_INTERVIEW"
  | "CONTINUE_INTERVIEW"
  | "VALIDATE_INTERVIEW"
  | "BUILD_KNOWLEDGE"
  | "BUILD_PROCESS_MAP"
  | "SELECT_PROCESS_MAP"
  | "VALIDATE_PROCESS_MAP"
  | "PUBLISH_PROCESS_MAP"
  | "GENERATE_ANALYSIS"
  | "VALIDATE_ANALYSIS"
  | "PUBLISH_ANALYSIS"
  | "GENERATE_AI_OPPORTUNITIES"
  | "VALIDATE_AI_OPPORTUNITIES"
  | "PUBLISH_AI_OPPORTUNITIES"
  | "GENERATE_AUTOMATION_OPPORTUNITIES"
  | "VALIDATE_AUTOMATION_OPPORTUNITIES"
  | "PUBLISH_AUTOMATION_OPPORTUNITIES"
  | "ENTER_ROI_ASSUMPTIONS"
  | "VALIDATE_ROI"
  | "PUBLISH_ROI"
  | "GENERATE_RECOMMENDATIONS"
  | "VALIDATE_RECOMMENDATIONS"
  | "PUBLISH_RECOMMENDATIONS"
  | "VIEW_RESULTS";

export interface AssistedAuditArtifactReference {
  id: string;
  version: number;
  status: string;
  lockVersion?: number;
}

export interface AssistedAuditStageView {
  stage: AssistedAuditStage;
  label: string;
  status: AssistedAuditStageStatus;
  artifact: AssistedAuditArtifactReference | null;
  candidateArtifacts: AssistedAuditArtifactReference[];
  availableActions: AssistedAuditAction[];
  blockingReason: string | null;
}

export interface AssistedAuditReadModel {
  company: { id: string; name: string };
  overallStatus: AssistedAuditStageStatus;
  currentStage: AssistedAuditStage;
  stages: AssistedAuditStageView[];
  nextAction: AssistedAuditAction | null;
  blockingReason: string | null;
}
