import { AiOpportunityEngine } from "../domain/ai-opportunity-engine";
import type { PrismaAiOpportunityRepository } from "../infrastructure/prisma-ai-opportunity-repository";
import {
  AiOpportunityConflictError,
  AiOpportunityForbiddenError,
  AiOpportunityNotFoundError,
  AiOpportunityValidationError,
} from "./ai-opportunity-errors";

export class AiOpportunityService {
  constructor(
    private readonly repo: PrismaAiOpportunityRepository,
    private readonly userId: string,
    private readonly engine = new AiOpportunityEngine(),
  ) {}
  private async context() {
    const context = await this.repo.context(this.userId);
    if (!context) throw new AiOpportunityForbiddenError();
    return context;
  }
  private editor(role: string) {
    if (role === "viewer") throw new AiOpportunityForbiddenError();
  }
  async detect(analysisId: string) {
    const context = await this.context();
    this.editor(context.role);
    const input = await this.repo.input(context.organizationId, analysisId);
    const source = await this.repo.analysis(context.organizationId, analysisId);
    if (!input || !source)
      throw new AiOpportunityValidationError("A published Business Analysis is required");
    return this.repo.persist(
      context.organizationId,
      source.companyId,
      this.userId,
      input,
      this.engine.detect(input),
      null,
    );
  }
  async rebuild(id: string, lockVersion: number) {
    const context = await this.context();
    this.editor(context.role);
    const current = await this.repo.snapshot(context.organizationId, id);
    if (!current) throw new AiOpportunityNotFoundError();
    if (current.lockVersion !== lockVersion) throw new AiOpportunityConflictError();
    const input = await this.repo.input(context.organizationId, current.businessAnalysisId);
    if (!input)
      throw new AiOpportunityValidationError("Published source contracts are unavailable");
    return this.repo.persist(
      context.organizationId,
      current.companyId,
      this.userId,
      input,
      this.engine.rebuild(input),
      current.id,
    );
  }
  async get(id: string) {
    const context = await this.context();
    const detail = await this.repo.detail(context.organizationId, id);
    if (!detail) throw new AiOpportunityNotFoundError();
    return detail;
  }
  async list(
    companyId: string,
    query: { page: number; pageSize: number; status?: string; capability?: string; risk?: string },
  ) {
    const context = await this.context();
    return this.repo.list(context.organizationId, companyId, query);
  }
  async validate(id: string, lockVersion: number) {
    const context = await this.context();
    this.editor(context.role);
    const detail = await this.repo.detail(context.organizationId, id);
    if (!detail) throw new AiOpportunityNotFoundError();
    if (detail.validations.some((validation) => validation.severity === "error"))
      throw new AiOpportunityValidationError("Blocking AI opportunity validation errors remain");
    return this.repo.transition(context.organizationId, id, lockVersion, "validated");
  }
  async publish(id: string, lockVersion: number) {
    const context = await this.context();
    if (!["owner", "admin"].includes(context.role)) throw new AiOpportunityForbiddenError();
    const detail = await this.repo.detail(context.organizationId, id);
    if (!detail) throw new AiOpportunityNotFoundError();
    const ids = new Set(detail.opportunities.map((opportunity) => opportunity.id));
    if (
      detail.validations.some((validation) => validation.severity === "error") ||
      detail.opportunities.some(
        (opportunity) =>
          !detail.evidence.some((item) => item.opportunityId === opportunity.id) ||
          !detail.capabilities.some((item) => item.opportunityId === opportunity.id) ||
          detail.scores.filter((score) => score.opportunityId === opportunity.id).length !== 6,
      ) ||
      detail.evidence.some((item) => !ids.has(item.opportunityId))
    )
      throw new AiOpportunityValidationError("AI opportunity traceability is incomplete");
    return this.repo.transition(context.organizationId, id, lockVersion, "published");
  }
}
