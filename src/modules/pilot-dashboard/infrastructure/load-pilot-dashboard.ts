import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import { AssistedAuditService } from "@/modules/assisted-audit/application/assisted-audit-service";
import { PrismaAssistedAuditRepository } from "@/modules/assisted-audit/infrastructure/prisma-assisted-audit-repository";
import type { PilotDashboardModel } from "../application/pilot-dashboard-model";
export async function loadPilotDashboard(
  db: TransactionClient,
  userId: string,
): Promise<PilotDashboardModel | null> {
  const membership = await db.organizationMember.findFirst({
    where: { userId },
    select: { organizationId: true },
  });
  if (!membership) return null;
  const companies = await db.company.findMany({
    where: { organizationId: membership.organizationId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true },
  });
  const service = new AssistedAuditService(new PrismaAssistedAuditRepository(db), userId);
  const rows = await Promise.all(
    companies.map(async (company) => {
      const audit = await service.get(company.id);
      return {
        id: company.id,
        name: company.name,
        auditStatus: audit.overallStatus,
        nextAction: audit.nextAction,
        complete: audit.currentStage === "COMPLETED",
      };
    }),
  );
  return {
    companies: rows,
    activeAudits: rows.filter((item) => !item.complete && item.nextAction !== "START_DISCOVERY")
      .length,
    completedAudits: rows.filter((item) => item.complete).length,
  };
}
