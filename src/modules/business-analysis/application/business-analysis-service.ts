import { BusinessAnalysisEngine } from "../domain/business-analysis-engine";
import type { PrismaBusinessAnalysisRepository } from "../infrastructure/prisma-business-analysis-repository";
import {
  BusinessAnalysisConflictError,
  BusinessAnalysisForbiddenError,
  BusinessAnalysisNotFoundError,
  BusinessAnalysisValidationError,
} from "./business-analysis-errors";

export class BusinessAnalysisService {
  constructor(
    private readonly repo: PrismaBusinessAnalysisRepository,
    private readonly userId: string,
    private readonly engine = new BusinessAnalysisEngine(),
  ) {}

  private async context() {
    const context = await this.repo.context(this.userId);
    if (!context) throw new BusinessAnalysisForbiddenError();
    return context;
  }

  private requireEditor(role: string) {
    if (role === "viewer") throw new BusinessAnalysisForbiddenError();
  }

  async analyze(processMapId: string) {
    const context = await this.context();
    this.requireEditor(context.role);
    const input = await this.repo.input(context.organizationId, processMapId);
    if (!input) throw new BusinessAnalysisValidationError("A published Process Map is required");
    const source = await this.repo.processMap(context.organizationId, processMapId);
    if (!source) throw new BusinessAnalysisValidationError("Published source is unavailable");
    return this.repo.persist(
      context.organizationId,
      source.companyId,
      source.knowledgeSnapshotId,
      processMapId,
      this.userId,
      input,
      this.engine.analyze(input),
      null,
    );
  }

  async rebuild(id: string, lockVersion: number) {
    const context = await this.context();
    this.requireEditor(context.role);
    const current = await this.repo.analysis(context.organizationId, id);
    if (!current) throw new BusinessAnalysisNotFoundError();
    if (current.lockVersion !== lockVersion) throw new BusinessAnalysisConflictError();
    const input = await this.repo.input(context.organizationId, current.processMapId);
    if (!input)
      throw new BusinessAnalysisValidationError("The published source Process Map is unavailable");
    return this.repo.persist(
      context.organizationId,
      current.companyId,
      current.knowledgeSnapshotId,
      current.processMapId,
      this.userId,
      input,
      this.engine.rebuild(input),
      current.id,
    );
  }

  async get(id: string) {
    const context = await this.context();
    const result = await this.repo.detail(context.organizationId, id);
    if (!result) throw new BusinessAnalysisNotFoundError();
    return result;
  }

  async list(
    companyId: string,
    query: {
      page: number;
      pageSize: number;
      status?: string;
      severity?: string;
      category?: string;
    },
  ) {
    const context = await this.context();
    return this.repo.list(context.organizationId, companyId, query);
  }

  async validate(id: string, lockVersion: number) {
    const context = await this.context();
    this.requireEditor(context.role);
    const detail = await this.repo.detail(context.organizationId, id);
    if (!detail) throw new BusinessAnalysisNotFoundError();
    if (detail.validations.some((validation) => validation.severity === "error"))
      throw new BusinessAnalysisValidationError("Blocking analysis validation errors remain");
    return this.repo.transition(context.organizationId, id, lockVersion, "validated");
  }

  async publish(id: string, lockVersion: number) {
    const context = await this.context();
    if (!["owner", "admin"].includes(context.role)) throw new BusinessAnalysisForbiddenError();
    const detail = await this.repo.detail(context.organizationId, id);
    if (!detail) throw new BusinessAnalysisNotFoundError();
    if (
      detail.validations.some((validation) => validation.severity === "error") ||
      detail.findings.some(
        (finding) => !detail.evidence.some((evidence) => evidence.findingId === finding.id),
      ) ||
      detail.scores.some((score) => {
        const calculation = score.calculationJson as { contributions?: unknown; formula?: unknown };
        return !calculation.formula || !Array.isArray(calculation.contributions);
      })
    )
      throw new BusinessAnalysisValidationError("Analysis traceability is incomplete");
    return this.repo.transition(context.organizationId, id, lockVersion, "published");
  }
}
