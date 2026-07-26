import { RecommendationPortfolioEngine } from "../domain/recommendation-engine";
import type { PrismaRecommendationPortfolioRepository } from "../infrastructure/prisma-recommendation-portfolio-repository";
import {
  RecommendationPortfolioConflictError,
  RecommendationPortfolioForbiddenError,
  RecommendationPortfolioNotFoundError,
  RecommendationPortfolioValidationError,
} from "./recommendation-errors";
export class RecommendationPortfolioService {
  constructor(
    private readonly repo: PrismaRecommendationPortfolioRepository,
    private readonly userId: string,
    private readonly engine = new RecommendationPortfolioEngine(),
  ) {}
  private async context() {
    const value = await this.repo.context(this.userId);
    if (!value) throw new RecommendationPortfolioForbiddenError();
    return value;
  }
  private editor(role: string) {
    if (role === "viewer") throw new RecommendationPortfolioForbiddenError();
  }
  async generate(roiId: string) {
    const context = await this.context();
    this.editor(context.role);
    const input = await this.repo.input(context.organizationId, roiId),
      source = await this.repo.roiSnapshot(context.organizationId, roiId);
    if (!input || !source)
      throw new RecommendationPortfolioValidationError(
        "A published ROI and aligned sources are required",
      );
    return this.repo.persist(
      context.organizationId,
      source.companyId,
      this.userId,
      input,
      this.engine.generate(input),
      null,
    );
  }
  async rebuild(id: string, lockVersion: number) {
    const context = await this.context();
    this.editor(context.role);
    const current = await this.repo.snapshot(context.organizationId, id);
    if (!current) throw new RecommendationPortfolioNotFoundError();
    if (current.lockVersion !== lockVersion) throw new RecommendationPortfolioConflictError();
    const input = await this.repo.input(context.organizationId, current.roiSnapshotId);
    if (!input) throw new RecommendationPortfolioValidationError("Published sources unavailable");
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
    if (!detail) throw new RecommendationPortfolioNotFoundError();
    return detail;
  }
  async list(
    companyId: string,
    query: {
      page: number;
      pageSize: number;
      status?: string;
      priority?: string;
      category?: string;
      phase?: string;
    },
  ) {
    const context = await this.context();
    return this.repo.list(context.organizationId, companyId, query);
  }
  async validate(id: string, lockVersion: number) {
    const context = await this.context();
    this.editor(context.role);
    const detail = await this.repo.detail(context.organizationId, id);
    if (!detail) throw new RecommendationPortfolioNotFoundError();
    if (detail.validations.some((item) => item.severity === "error"))
      throw new RecommendationPortfolioValidationError("Blocking validation errors remain");
    return this.repo.transition(context.organizationId, id, lockVersion, "validated");
  }
  async publish(id: string, lockVersion: number) {
    const context = await this.context();
    if (!["owner", "admin"].includes(context.role))
      throw new RecommendationPortfolioForbiddenError();
    const detail = await this.repo.detail(context.organizationId, id);
    if (!detail) throw new RecommendationPortfolioNotFoundError();
    if (
      detail.validations.some((item) => item.severity === "error") ||
      detail.recommendations.some(
        (item) =>
          !detail.evidence.some((e) => e.recommendationId === item.id) ||
          detail.contributions.filter((c) => c.recommendationId === item.id).length !== 6,
      )
    )
      throw new RecommendationPortfolioValidationError("Portfolio traceability incomplete");
    return this.repo.transition(context.organizationId, id, lockVersion, "published");
  }
}
