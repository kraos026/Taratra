import { RoiEvaluationEngine, type AssumptionCode } from "../domain/roi-engine";
import type { PrismaRoiEvaluationRepository } from "../infrastructure/prisma-roi-evaluation-repository";
import {
  RoiConflictError,
  RoiForbiddenError,
  RoiNotFoundError,
  RoiValidationError,
} from "./roi-errors";
export class RoiEvaluationService {
  constructor(
    private readonly repo: PrismaRoiEvaluationRepository,
    private readonly userId: string,
    private readonly engine = new RoiEvaluationEngine(),
  ) {}
  private async context() {
    const value = await this.repo.context(this.userId);
    if (!value) throw new RoiForbiddenError();
    return value;
  }
  private editor(role: string) {
    if (role === "viewer") throw new RoiForbiddenError();
  }
  async evaluate(
    automationSnapshotId: string,
    request: {
      currency: string;
      suppliedAssumptions: Partial<Record<AssumptionCode, number>>;
      unknownAssumptions: AssumptionCode[];
    },
  ) {
    const context = await this.context();
    this.editor(context.role);
    const input = await this.repo.input(
      context.organizationId,
      automationSnapshotId,
      request.currency,
      request.suppliedAssumptions,
      request.unknownAssumptions,
    );
    const source = await this.repo.automationSnapshot(context.organizationId, automationSnapshotId);
    if (!input || !source)
      throw new RoiValidationError(
        "A published Automation Opportunity and aligned canonical sources are required",
      );
    return this.repo.persist(
      context.organizationId,
      source.companyId,
      this.userId,
      input,
      this.engine.evaluate(input),
      null,
    );
  }
  async rebuild(id: string, lockVersion: number) {
    const context = await this.context();
    this.editor(context.role);
    const current = await this.repo.snapshot(context.organizationId, id);
    if (!current) throw new RoiNotFoundError();
    if (current.lockVersion !== lockVersion) throw new RoiConflictError();
    const frozen = await this.repo.frozenAssumptions(context.organizationId, id);
    const input = await this.repo.input(
      context.organizationId,
      current.automationOpportunitySnapshotId,
      current.currency,
      frozen.suppliedAssumptions,
      frozen.unknownAssumptions,
    );
    if (!input) throw new RoiValidationError("Published source contracts are unavailable");
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
    const value = await this.repo.detail(context.organizationId, id);
    if (!value) throw new RoiNotFoundError();
    return value;
  }
  async list(
    companyId: string,
    query: { page: number; pageSize: number; status?: string; scenario?: string },
  ) {
    const context = await this.context();
    return this.repo.list(context.organizationId, companyId, query);
  }
  async validate(id: string, lockVersion: number) {
    const context = await this.context();
    this.editor(context.role);
    const detail = await this.repo.detail(context.organizationId, id);
    if (!detail) throw new RoiNotFoundError();
    if (detail.validations.some((item) => item.severity === "error"))
      throw new RoiValidationError("Blocking ROI validation errors remain");
    return this.repo.transition(context.organizationId, id, lockVersion, "validated");
  }
  async publish(id: string, lockVersion: number) {
    const context = await this.context();
    if (!["owner", "admin"].includes(context.role)) throw new RoiForbiddenError();
    const detail = await this.repo.detail(context.organizationId, id);
    if (!detail) throw new RoiNotFoundError();
    if (
      detail.validations.some((item) => item.severity === "error") ||
      detail.scenarios.length !== 3 ||
      detail.evaluations.some(
        (item) =>
          detail.metrics.filter((metric) => metric.evaluationId === item.id).length !== 13 ||
          !detail.evidence.some((evidence) => evidence.evaluationId === item.id),
      )
    )
      throw new RoiValidationError("ROI traceability is incomplete");
    return this.repo.transition(context.organizationId, id, lockVersion, "published");
  }
}
