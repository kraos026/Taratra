import type { WorkActivityRepository } from "@/modules/work-intelligence/application/work-activity-repository";
import { WorkIntelligenceKnowledgeProjector } from "../domain/knowledge-projection";
import type { PrismaKnowledgeRepository } from "../infrastructure/prisma-knowledge-repository";
import { KnowledgeProjectionError } from "./knowledge-errors";

export interface ProjectConfirmedWorkIntelligenceToKnowledgeCommand {
  tenantId: string;
  companyId: string;
  activityId: string;
}

export class ProjectConfirmedWorkIntelligenceToKnowledge {
  constructor(
    private readonly knowledgeRepository: PrismaKnowledgeRepository,
    private readonly workActivities: WorkActivityRepository,
    private readonly userId: string,
    private readonly clock: { now(): Date },
    private readonly projector = new WorkIntelligenceKnowledgeProjector(),
  ) {}

  async execute(command: ProjectConfirmedWorkIntelligenceToKnowledgeCommand) {
    const context = await this.knowledgeRepository.contextForOrganization(
      this.userId,
      command.tenantId,
    );
    if (!context || !["owner", "admin", "consultant"].includes(context.role))
      throw new KnowledgeProjectionError("FORBIDDEN", "Knowledge projection is not permitted");
    const activity = await this.workActivities.get(
      command.tenantId,
      command.companyId,
      command.activityId,
    );
    if (!activity)
      throw new KnowledgeProjectionError("WORK_ACTIVITY_NOT_FOUND", "Work activity was not found");
    if (!["CONFIRMED", "CORRECTED"].includes(activity.confirmationState))
      throw new KnowledgeProjectionError(
        "WORK_ACTIVITY_NOT_PROJECTABLE",
        "Only confirmed or corrected Work Intelligence can be projected",
      );
    const current = await this.workActivities.latest(
      command.tenantId,
      command.companyId,
      activity.lineageId,
    );
    if (!current || current.activityId !== activity.activityId)
      throw new KnowledgeProjectionError(
        "WORK_ACTIVITY_NOT_CURRENT",
        "Only the current Work Intelligence version can be projected",
      );
    const projection = this.projector.project(activity, this.clock.now());
    return this.knowledgeRepository.persist(
      command.tenantId,
      command.companyId,
      this.userId,
      projection,
    );
  }
}
