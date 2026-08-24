import { EnterpriseKnowledgeProjector } from "../domain/knowledge-projection";
import type {
  DiscoveryKnowledgeInput,
  InterviewKnowledgeInput,
} from "../domain/knowledge-projection";
import type { PrismaKnowledgeRepository } from "../infrastructure/prisma-knowledge-repository";
import {
  prepareKnowledgePersistencePlan,
  type PreparedKnowledgePersistencePlan,
} from "../infrastructure/prisma-knowledge-repository";
import { KnowledgeProjectionError } from "./knowledge-errors";

export interface EnterpriseKnowledgeBuildInput {
  organizationId: string;
  companyId: string;
  userId: string;
  input: {
    discovery: DiscoveryKnowledgeInput;
    interview: InterviewKnowledgeInput | null;
  };
}

export interface PreparedEnterpriseKnowledgeBuild {
  organizationId: string;
  companyId: string;
  userId: string;
  plan: PreparedKnowledgePersistencePlan;
}

export class EnterpriseKnowledgeService {
  constructor(
    private readonly repository: PrismaKnowledgeRepository,
    private readonly userId: string,
    private readonly projector = new EnterpriseKnowledgeProjector(),
  ) {}

  async build(companyId: string) {
    return this.persistPreparedBuild(
      EnterpriseKnowledgeService.preparePersistencePlan(
        await this.readBuildInput(companyId),
        this.projector,
      ),
    );
  }

  async readBuildInput(companyId: string): Promise<EnterpriseKnowledgeBuildInput> {
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
    return {
      organizationId: context.organizationId,
      companyId,
      userId: this.userId,
      input: { discovery: input.discovery, interview: input.interview },
    };
  }

  static preparePersistencePlan(
    input: EnterpriseKnowledgeBuildInput,
    projector = new EnterpriseKnowledgeProjector(),
  ): PreparedEnterpriseKnowledgeBuild {
    const projection = projector.project(input.input.discovery, input.input.interview);
    return {
      organizationId: input.organizationId,
      companyId: input.companyId,
      userId: input.userId,
      plan: prepareKnowledgePersistencePlan(projection),
    };
  }

  async persistPreparedBuild(prepared: PreparedEnterpriseKnowledgeBuild) {
    return this.repository.persistPrepared(
      prepared.organizationId,
      prepared.companyId,
      prepared.userId,
      prepared.plan,
    );
  }
}
