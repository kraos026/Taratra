import {
  AutomationSpecificationAggregate,
  AutomationSpecificationInvariantError,
} from "../domain/automation-specification-aggregate";
import { AutomationSpecificationEngine } from "../domain/automation-specification-engine";
import type { AutomationSpecificationRepository } from "./automation-specification-repository";
import {
  AutomationSpecificationConflictError,
  AutomationSpecificationForbiddenError,
  AutomationSpecificationNotFoundError,
  AutomationSpecificationValidationError,
} from "./automation-specification-errors";

export class AutomationSpecificationService {
  constructor(
    private readonly repository: AutomationSpecificationRepository,
    private readonly userId: string,
    private readonly engine = new AutomationSpecificationEngine(),
  ) {}

  async generate(solutionBlueprintId: string) {
    const context = await this.editorContext();
    const input = await this.repository.input(context.organizationId, solutionBlueprintId);
    if (!input) throw new AutomationSpecificationValidationError("Published Blueprint required");
    return this.repository.persist(
      context.organizationId,
      this.userId,
      input,
      this.engine.generate(input),
      null,
    );
  }

  async rebuild(id: string, lockVersion: number) {
    const context = await this.editorContext();
    const current = await this.repository.prepareRebuild(context.organizationId, id, lockVersion);
    if (!current) throw new AutomationSpecificationNotFoundError();
    this.enforce(() => this.aggregate(current, []).prepareRebuild(lockVersion));
    const input = await this.repository.input(context.organizationId, current.solutionBlueprintId);
    if (!input) throw new AutomationSpecificationValidationError("Published Blueprint required");
    return this.repository.persist(
      context.organizationId,
      this.userId,
      input,
      this.engine.rebuild(input),
      current.id,
    );
  }

  async validate(id: string, lockVersion: number) {
    const context = await this.editorContext();
    const detail = await this.requireDetail(context.organizationId, id);
    this.enforce(() =>
      this.aggregate(detail.specification, detail.validations).validate(lockVersion),
    );
    return this.repository.transition(context.organizationId, id, lockVersion, "validated");
  }

  async publish(id: string, lockVersion: number) {
    const context = await this.publisherContext();
    const detail = await this.requireDetail(context.organizationId, id);
    this.enforce(() =>
      this.aggregate(detail.specification, detail.validations).publish(lockVersion),
    );
    return this.repository.transition(context.organizationId, id, lockVersion, "published");
  }

  async archive(id: string, lockVersion: number) {
    const context = await this.publisherContext();
    const detail = await this.requireDetail(context.organizationId, id);
    this.enforce(() =>
      this.aggregate(detail.specification, detail.validations).archive(lockVersion),
    );
    return this.repository.transition(context.organizationId, id, lockVersion, "archived");
  }

  async get(id: string) {
    const context = await this.context();
    return this.requireDetail(context.organizationId, id);
  }

  async list(
    solutionBlueprintId: string,
    query: {
      page: number;
      pageSize: number;
      status?: "draft" | "validated" | "published" | "archived";
      latestPublished?: boolean;
    },
  ) {
    const context = await this.context();
    return this.repository.list(context.organizationId, solutionBlueprintId, query);
  }

  private async context() {
    const context = await this.repository.context(this.userId);
    if (!context) throw new AutomationSpecificationForbiddenError();
    return context;
  }

  private async editorContext() {
    const context = await this.context();
    if (context.role === "viewer") throw new AutomationSpecificationForbiddenError();
    return context;
  }

  private async publisherContext() {
    const context = await this.context();
    if (context.role !== "admin" && context.role !== "owner")
      throw new AutomationSpecificationForbiddenError();
    return context;
  }

  private async requireDetail(organizationId: string, id: string) {
    const detail = await this.repository.detail(organizationId, id);
    if (!detail) throw new AutomationSpecificationNotFoundError();
    return detail;
  }

  private aggregate(
    snapshot: {
      id: string;
      status: "draft" | "validated" | "published" | "archived";
      lockVersion: number;
      versionNumber: number;
      isLatestVersion: boolean;
    },
    validations: Parameters<typeof AutomationSpecificationAggregate.rehydrate>[0]["validations"],
  ) {
    return AutomationSpecificationAggregate.rehydrate({ ...snapshot, validations });
  }

  private enforce(operation: () => unknown) {
    try {
      operation();
    } catch (error) {
      if (error instanceof AutomationSpecificationInvariantError) {
        if (error.kind === "conflict") throw new AutomationSpecificationConflictError();
        throw new AutomationSpecificationValidationError();
      }
      throw error;
    }
  }
}
