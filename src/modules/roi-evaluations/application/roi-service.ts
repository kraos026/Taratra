import { RoiEvaluationEngine, type AssumptionCode, type RoiInput } from "../domain/roi-engine";
import type { PrismaRoiEvaluationRepository } from "../infrastructure/prisma-roi-evaluation-repository";
import type { PreparedRoiPersistencePlan } from "../infrastructure/prisma-roi-evaluation-repository";
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
    const prepared = await this.evaluateInput(automationSnapshotId, request);
    return this.repo.persist(
      prepared.organizationId,
      prepared.companyId,
      this.userId,
      prepared.input,
      this.engine.evaluate(prepared.input),
      null,
    );
  }
  async evaluateInput(
    automationSnapshotId: string,
    request: {
      currency: string;
      suppliedAssumptions: Partial<Record<AssumptionCode, number>>;
      unknownAssumptions: AssumptionCode[];
    },
  ): Promise<RoiPreparedInput> {
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
    return {
      organizationId: context.organizationId,
      companyId: source.companyId,
      input,
      previousVersionId: null,
    };
  }
  async rebuild(id: string, lockVersion: number) {
    const prepared = await this.rebuildInput(id, lockVersion);
    return this.repo.persist(
      prepared.organizationId,
      prepared.companyId,
      this.userId,
      prepared.input,
      this.engine.rebuild(prepared.input),
      prepared.previousVersionId,
      prepared.expectedPreviousLockVersion,
    );
  }
  async rebuildInput(id: string, lockVersion: number): Promise<RoiPreparedInput> {
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
    return {
      organizationId: context.organizationId,
      companyId: current.companyId,
      input,
      previousVersionId: current.id,
      expectedPreviousLockVersion: current.lockVersion,
    };
  }
  async revise(
    id: string,
    request: {
      lockVersion: number;
      currency: string;
      suppliedAssumptions: Partial<Record<AssumptionCode, number>>;
      unknownAssumptions: AssumptionCode[];
    },
  ) {
    const prepared = await this.reviseInput(id, request);
    return this.repo.persist(
      prepared.organizationId,
      prepared.companyId,
      this.userId,
      prepared.input,
      this.engine.evaluate(prepared.input),
      prepared.previousVersionId,
      prepared.expectedPreviousLockVersion,
      "draft",
    );
  }
  async reviseInput(
    id: string,
    request: {
      lockVersion: number;
      currency: string;
      suppliedAssumptions: Partial<Record<AssumptionCode, number>>;
      unknownAssumptions: AssumptionCode[];
    },
  ): Promise<RoiPreparedInput> {
    const context = await this.context();
    this.editor(context.role);
    const current = await this.repo.snapshot(context.organizationId, id);
    if (!current) throw new RoiNotFoundError();
    if (current.status !== "draft") throw new RoiValidationError("Only a draft ROI can be revised");
    if (current.lockVersion !== request.lockVersion) throw new RoiConflictError();
    const input = await this.repo.input(
      context.organizationId,
      current.automationOpportunitySnapshotId,
      request.currency,
      request.suppliedAssumptions,
      request.unknownAssumptions,
    );
    if (!input) throw new RoiValidationError("Published source contracts are unavailable");
    return {
      organizationId: context.organizationId,
      companyId: current.companyId,
      input,
      previousVersionId: current.id,
      expectedPreviousLockVersion: request.lockVersion,
      expectedPreviousStatus: "draft",
    };
  }
  calculate(input: RoiInput, mode: "evaluate" | "rebuild" = "evaluate") {
    return mode === "rebuild" ? this.engine.rebuild(input) : this.engine.evaluate(input);
  }
  async persistPrepared(prepared: RoiPreparedInput, plan: PreparedRoiPersistencePlan) {
    const context = await this.context();
    this.editor(context.role);
    if (context.organizationId !== prepared.organizationId) throw new RoiForbiddenError();
    return this.repo.persistPrepared(
      prepared.organizationId,
      prepared.companyId,
      this.userId,
      prepared.input,
      plan,
      prepared.previousVersionId,
      prepared.expectedPreviousLockVersion,
      prepared.expectedPreviousStatus,
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

export interface RoiPreparedInput {
  readonly organizationId: string;
  readonly companyId: string;
  readonly input: RoiInput;
  readonly previousVersionId: string | null;
  readonly expectedPreviousLockVersion?: number;
  readonly expectedPreviousStatus?: "draft";
}
