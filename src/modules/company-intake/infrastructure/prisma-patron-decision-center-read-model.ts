import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import { ExecutiveResultService } from "@/modules/executive-results/application/executive-result-service";
import { PrismaExecutiveResultRepository } from "@/modules/executive-results/infrastructure/prisma-executive-result-repository";
import type { ExecutiveDecisionView } from "../application/executive-decision-view";
import type { PatronDecisionCenterReadModelPort } from "../application/patron-decision-center";
import { ProductionExecutiveDecisionViewBuilder } from "../application/production-executive-decision-view";

export class PrismaPatronDecisionCenterReadModel implements PatronDecisionCenterReadModelPort {
  constructor(
    private readonly db: TransactionClient,
    private readonly builder = new ProductionExecutiveDecisionViewBuilder(),
  ) {}

  async read(input: {
    readonly userId: string;
    readonly companyId: string;
  }): Promise<ExecutiveDecisionView | null> {
    const membership = await this.db.organizationMember.findFirst({
      where: { userId: input.userId },
      select: { organizationId: true },
    });
    if (!membership) return null;

    const result = await new ExecutiveResultService(
      new PrismaExecutiveResultRepository(this.db),
      input.userId,
    ).get(input.companyId);
    if (!result || result.company.id !== input.companyId) return null;

    const projection = this.builder.build({
      tenantId: membership.organizationId,
      result,
    });
    return projection.view;
  }
}
