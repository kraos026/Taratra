import type {
  AssistedAuditAction,
  AssistedAuditStageStatus,
} from "@/modules/assisted-audit/application/assisted-audit-model";
export interface PilotDashboardModel {
  companies: {
    id: string;
    name: string;
    auditStatus: AssistedAuditStageStatus;
    nextAction: AssistedAuditAction | null;
    complete: boolean;
  }[];
  activeAudits: number;
  completedAudits: number;
}
