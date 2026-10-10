import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import { ExecutiveResultService } from "@/modules/executive-results/application/executive-result-service";
import { PrismaExecutiveResultRepository } from "@/modules/executive-results/infrastructure/prisma-executive-result-repository";
import { CompanyNotFoundError } from "../domain/company-errors";
import { boundedExportRows } from "./audit-export-limits";

// Internal helper: caller must first validate live owner/admin membership and company.
export async function exportDocumentsAndSummary(
  db: TransactionClient,
  userId: string,
  organizationId: string,
  companyId: string,
) {
  const documentSources = boundedExportRows(
    await db.auditProductionEvidenceSourceRecord.findMany({
      where: { organizationId, companyId },
      orderBy: { id: "asc" },
      take: 1001,
      select: {
        id: true,
        sourceKey: true,
        sourceVersion: true,
        sourceType: true,
        origin: true,
        authorOrSystem: true,
        rawContent: true,
        structuredJson: true,
        receivedAt: true,
        ingestedAt: true,
        createdAt: true,
      },
    }),
  );
  const sourceIds = documentSources.map((source) => source.id);
  const acquiredEvidence = sourceIds.length
    ? boundedExportRows(
        await db.auditProductionEvidenceRecord.findMany({
          where: { organizationId, companyId, sourceId: { in: sourceIds } },
          orderBy: { id: "asc" },
          take: 1001,
          select: {
            id: true,
            sourceId: true,
            evidenceKey: true,
            content: true,
            structuredJson: true,
            confidence: true,
            createdAt: true,
          },
        }),
      )
    : [];
  const result = await new ExecutiveResultService(
    new PrismaExecutiveResultRepository(db),
    userId,
  ).get(companyId);
  if (
    !result ||
    result.company.id !== companyId ||
    (result.organizationId && result.organizationId !== organizationId)
  )
    throw new CompanyNotFoundError();
  // Select the customer read model, not ORM entities or technical decision scopes.
  const currentSummary = {
    company: { id: result.company.id, name: result.company.name },
    complete: result.complete,
    overview: result.overview,
    process: result.process,
    findings: boundedExportRows(result.findings),
    opportunities: boundedExportRows(result.opportunities).map((item) => ({
      id: item.id,
      title: item.title,
      problem: item.problem,
      impact: item.impact,
      readiness: item.readiness,
      confidence: item.confidence,
      evidence: item.safety?.evidence ?? [],
      observations: item.safety?.observations ?? [],
      prerequisites: item.safety?.prerequisites ?? [],
    })),
    roi: result.roi
      ? { ...result.roi, evaluations: boundedExportRows(result.roi.evaluations) }
      : null,
    recommendations: boundedExportRows(result.recommendations),
    provenance: result.provenance,
  };
  return { documentSources, acquiredEvidence, currentSummary };
}
