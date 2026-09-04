import type { PilotFeedbackInput, PilotFeedbackView } from "./pilot-feedback-schema";

export type PilotFeedbackContext = {
  organizationId: string;
  companyId: string;
  auditId: string | null;
  executiveResultId: string | null;
  contextStatus: "AUDIT_IN_PROGRESS" | "AUDIT_COMPLETE";
};

export interface PilotFeedbackRepository {
  resolveContext(userId: string, companyId: string): Promise<PilotFeedbackContext | null>;
  find(userId: string, context: PilotFeedbackContext): Promise<PilotFeedbackView | null>;
  save(
    userId: string,
    context: PilotFeedbackContext,
    input: PilotFeedbackInput,
  ): Promise<PilotFeedbackView>;
}
