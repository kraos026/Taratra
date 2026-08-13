import { EnterpriseKnowledgeProjector } from "../domain/knowledge-projection";
import type { PrismaKnowledgeRepository } from "../infrastructure/prisma-knowledge-repository";
import { KnowledgeProjectionError } from "./knowledge-errors";

export class EnterpriseKnowledgeService {
  constructor(
    private readonly repository: PrismaKnowledgeRepository,
    private readonly userId: string,
    private readonly projector = new EnterpriseKnowledgeProjector(),
  ) {}

  async build(companyId: string) {
    const context = await this.repository.context(this.userId);
    if (!context || context.role === "viewer")
      throw new KnowledgeProjectionError("FORBIDDEN", "Knowledge projection is not permitted");
    if (!(await this.repository.companyExists(context.organizationId, companyId)))
      throw new KnowledgeProjectionError(
        "COMPANY_NOT_FOUND",
        "Company was not found in the authenticated tenant",
      );
    const input = await this.repository.inputs(context.organizationId, companyId);
    if (!input.discovery)
      throw new KnowledgeProjectionError(
        "DISCOVERY_REQUIRED",
        "A validated Discovery profile is required",
      );
    const projection = this.projector.project(input.discovery, input.interview);
    return this.repository.persist(context.organizationId, companyId, this.userId, projection);
  }
}
