import { AutomationOpportunityEngine } from "../domain/automation-opportunity-engine";
import type { PrismaAutomationOpportunityRepository } from "../infrastructure/prisma-automation-opportunity-repository";
import {
  AutomationOpportunityConflictError,
  AutomationOpportunityForbiddenError,
  AutomationOpportunityNotFoundError,
  AutomationOpportunityValidationError,
} from "./automation-opportunity-errors";

export class AutomationOpportunityService {
  constructor(
    private readonly repo: PrismaAutomationOpportunityRepository,
    private readonly userId: string,
    private readonly engine = new AutomationOpportunityEngine(),
  ) {}
  private async context() {
    const context = await this.repo.context(this.userId);
    if (!context) throw new AutomationOpportunityForbiddenError();
    return context;
  }
  private editor(role: string) {
    if (role === "viewer") throw new AutomationOpportunityForbiddenError();
  }
  async detect(aiSnapshotId: string) {
    const context = await this.context();
    this.editor(context.role);
    const input = await this.repo.input(context.organizationId, aiSnapshotId);
    const source = await this.repo.aiSnapshot(context.organizationId, aiSnapshotId);
    if (!input || !source)
      throw new AutomationOpportunityValidationError(
        "A published AI Opportunity snapshot and aligned canonical sources are required",
      );
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
    if (!current) throw new AutomationOpportunityNotFoundError();
    if (current.lockVersion !== lockVersion) throw new AutomationOpportunityConflictError();
    const input = await this.repo.input(context.organizationId, current.aiOpportunitySnapshotId);
    if (!input)
      throw new AutomationOpportunityValidationError("Published source contracts are unavailable");
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
    if (!detail) throw new AutomationOpportunityNotFoundError();
    return detail;
  }
  async list(
    companyId: string,
    query: {
      page: number;
      pageSize: number;
      status?: string;
      pattern?: string;
      connector?: string;
    },
  ) {
    const context = await this.context();
    return this.repo.list(context.organizationId, companyId, query);
  }
  async validate(id: string, lockVersion: number) {
    const context = await this.context();
    this.editor(context.role);
    const detail = await this.repo.detail(context.organizationId, id);
    if (!detail) throw new AutomationOpportunityNotFoundError();
    if (detail.validations.some((item) => item.severity === "error"))
      throw new AutomationOpportunityValidationError("Blocking validation errors remain");
    return this.repo.transition(context.organizationId, id, lockVersion, "validated");
  }
  async publish(id: string, lockVersion: number) {
    const context = await this.context();
    if (!["owner", "admin"].includes(context.role)) throw new AutomationOpportunityForbiddenError();
    const detail = await this.repo.detail(context.organizationId, id);
    if (!detail) throw new AutomationOpportunityNotFoundError();
    if (
      detail.validations.some((item) => item.severity === "error") ||
      detail.opportunities.some(
        (item) =>
          !detail.evidence.some((evidence) => evidence.opportunityId === item.id) ||
          !detail.patterns.some((pattern) => pattern.id === item.patternId) ||
          detail.scores.filter((score) => score.opportunityId === item.id).length !== 7,
      )
    )
      throw new AutomationOpportunityValidationError(
        "Automation opportunity traceability is incomplete",
      );
    return this.repo.transition(context.organizationId, id, lockVersion, "published");
  }
}
