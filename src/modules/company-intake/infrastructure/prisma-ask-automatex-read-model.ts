import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import type {
  AskAutomateXReadModel,
  AskAutomateXReadModelPort,
} from "../application/ask-automatex";
import { PrismaPatronDecisionCenterReadModel } from "./prisma-patron-decision-center-read-model";

export class PrismaAskAutomateXReadModel implements AskAutomateXReadModelPort {
  constructor(private readonly db: TransactionClient) {}

  async read(input: {
    readonly tenantId: string;
    readonly companyId: string;
    readonly userId: string;
  }): Promise<AskAutomateXReadModel | null> {
    const view = await new PrismaPatronDecisionCenterReadModel(this.db).read({
      userId: input.userId,
      companyId: input.companyId,
    });
    if (!view) return null;
    if (view.company.tenantId !== input.tenantId || view.company.id !== input.companyId)
      return null;
    return { view };
  }
}
