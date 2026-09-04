import type { PilotFeedbackInput, PilotFeedbackView } from "./pilot-feedback-schema";
import type { PilotFeedbackRepository } from "./pilot-feedback-repository";

export class PilotFeedbackNotFoundError extends Error {}

export class PilotFeedbackService {
  constructor(
    private readonly repository: PilotFeedbackRepository,
    private readonly userId: string,
  ) {}

  async get(companyId: string): Promise<PilotFeedbackView | null> {
    const context = await this.repository.resolveContext(this.userId, companyId);
    if (!context) throw new PilotFeedbackNotFoundError("Entreprise introuvable");
    return this.repository.find(this.userId, context);
  }

  async save(input: PilotFeedbackInput): Promise<PilotFeedbackView> {
    const context = await this.repository.resolveContext(this.userId, input.companyId);
    if (!context) throw new PilotFeedbackNotFoundError("Entreprise introuvable");
    return this.repository.save(this.userId, context, input);
  }
}
