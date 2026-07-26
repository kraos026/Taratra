import { SolutionDesigner } from "../domain/solution-designer";
import type { PrismaSolutionBlueprintRepository } from "../infrastructure/prisma-solution-blueprint-repository";
import {
  SolutionBlueprintConflictError,
  SolutionBlueprintForbiddenError,
  SolutionBlueprintNotFoundError,
  SolutionBlueprintValidationError,
} from "./solution-blueprint-errors";

export class SolutionBlueprintService {
  constructor(
    private readonly repository: PrismaSolutionBlueprintRepository,
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
    const current = await this.repository.snapshot(context.organizationId, id);
    if (!current) throw new SolutionBlueprintNotFoundError();
    if (current.lockVersion !== lockVersion) throw new SolutionBlueprintConflictError();
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
    if (detail.validations.some((item) => item.severity === "error"))
      throw new SolutionBlueprintValidationError("Blocking validation errors remain");
    return this.repository.transition(context.organizationId, id, lockVersion, "validated");
  }
  async publish(id: string, lockVersion: number) {
    const context = await this.context();
    if (!["owner", "admin"].includes(context.role)) throw new SolutionBlueprintForbiddenError();
    const detail = await this.repository.detail(context.organizationId, id);
    if (!detail) throw new SolutionBlueprintNotFoundError();
    if (detail.validations.some((item) => item.severity === "error") || !detail.evidence.length)
      throw new SolutionBlueprintValidationError("Blueprint traceability is incomplete");
    return this.repository.transition(context.organizationId, id, lockVersion, "published");
  }
}
