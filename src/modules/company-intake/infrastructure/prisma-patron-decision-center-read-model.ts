import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import { ExecutiveResultService } from "@/modules/executive-results/application/executive-result-service";
import { AssistedAuditError } from "@/modules/assisted-audit/application/assisted-audit-errors";
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
    const [membership, result] = await Promise.all([
      this.db.organizationMember.findFirst({
        where: { userId: input.userId },
        select: { organizationId: true },
      }),
      new ExecutiveResultService(new PrismaExecutiveResultRepository(this.db), input.userId).get(
        input.companyId,
      ),
    ]);
    if (!membership || !result || result.company.id !== input.companyId)
      throw new AssistedAuditError("COMPANY_NOT_FOUND", "Entreprise introuvable", 404);

    const projection = this.builder.build({
      tenantId: membership.organizationId,
      result,
    });
    return projection.view;
  }
}
