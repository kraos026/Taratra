import { SolutionDesigner } from "../domain/solution-designer";
import {
  SolutionBlueprintAggregate,
  SolutionBlueprintInvariantError,
} from "../domain/solution-blueprint-aggregate";
import {
  SolutionBlueprintConflictError,
  SolutionBlueprintForbiddenError,
  SolutionBlueprintNotFoundError,
  SolutionBlueprintValidationError,
} from "./solution-blueprint-errors";
import type { BlueprintDetail, SolutionBlueprintRepository } from "./solution-blueprint-repository";

export class SolutionBlueprintService {
  constructor(
    private readonly repository: SolutionBlueprintRepository,
    private readonly userId: string,
    private readonly designer = new SolutionDesigner(),
  ) {}
  private async context() {
    const context = await this.repository.context(this.userId);
    if (!context) throw new SolutionBlueprintForbiddenError();
    return context;
  }
  private ensureEditor(role: string) {
    if (role === "viewer") throw new SolutionBlueprintForbiddenError();
  }
  async generate(recommendationId: string) {
    const context = await this.context();
    this.ensureEditor(context.role);
    const input = await this.repository.input(context.organizationId, recommendationId);
    if (!input) throw new SolutionBlueprintValidationError("Published canonical sources required");
    return this.repository.persist(
      context.organizationId,
      this.userId,
      input,
      this.designer.generate(input),
      null,
    );
  }
  async rebuild(id: string, lockVersion: number) {
    const context = await this.context();
    this.ensureEditor(context.role);
    const current = await this.repository.prepareRebuild(context.organizationId, id, lockVersion);
    if (!current) throw new SolutionBlueprintNotFoundError();
    this.enforceInvariant(() => this.aggregate(current, [], 0).prepareRebuild(lockVersion));
    const input = await this.repository.input(context.organizationId, current.recommendationId);
    if (!input) throw new SolutionBlueprintValidationError("Published canonical sources required");
    return this.repository.persist(
      context.organizationId,
      this.userId,
      input,
      this.designer.rebuild(input),
      current.id,
    );
  }
  async get(id: string) {
    const context = await this.context();
    const result = await this.repository.detail(context.organizationId, id);
    if (!result) throw new SolutionBlueprintNotFoundError();
    return result;
  }
  async list(companyId: string, query: { page: number; pageSize: number; status?: string }) {
    const context = await this.context();
    return this.repository.list(context.organizationId, companyId, query);
  }
  async validate(id: string, lockVersion: number) {
    const context = await this.context();
    this.ensureEditor(context.role);
    const detail = await this.repository.detail(context.organizationId, id);
    if (!detail) throw new SolutionBlueprintNotFoundError();
    this.enforceInvariant(() =>
      this.aggregate(detail.blueprint, detail.validations, detail.evidence.length).validate(
        lockVersion,
      ),
    );
    return this.repository.transition(context.organizationId, id, lockVersion, "validated");
  }
  async publish(id: string, lockVersion: number) {
    const context = await this.context();
    if (!["owner", "admin"].includes(context.role)) throw new SolutionBlueprintForbiddenError();
    const detail = await this.repository.detail(context.organizationId, id);
    if (!detail) throw new SolutionBlueprintNotFoundError();
    this.enforceInvariant(() =>
      this.aggregate(detail.blueprint, detail.validations, detail.evidence.length).publish(
        lockVersion,
      ),
    );
    return this.repository.transition(context.organizationId, id, lockVersion, "published");
  }

  private aggregate(
    blueprint: BlueprintDetail["blueprint"],
    validations: BlueprintDetail["validations"],
    evidenceCount: number,
  ) {
    return SolutionBlueprintAggregate.rehydrate({
      ...blueprint,
      validations,
      evidenceCount,
    });
  }

  private enforceInvariant(operation: () => unknown) {
    try {
      return operation();
    } catch (error) {
      this.mapInvariant(error);
    }
  }

  private mapInvariant(error: unknown): never {
    if (error instanceof SolutionBlueprintInvariantError) {
      if (error.kind === "conflict") throw new SolutionBlueprintConflictError();
      throw new SolutionBlueprintValidationError(error.message);
    }
    throw error;
  }
}
