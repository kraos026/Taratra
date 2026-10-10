import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import { CompanyNotFoundError, CompanyPermissionError } from "../domain/company-errors";

const limit = 1000;
export class ExportLimitError extends Error {}

// Data-access operation only: never rebuild or mutate canonical artifacts.
export async function exportAuditSources(db: TransactionClient, userId: string, companyId: string) {
  const membership = await db.organizationMember.findFirst({
    where: { userId },
    select: { organizationId: true, role: true },
  });
  if (!membership || !["owner", "admin"].includes(membership.role))
    throw new CompanyPermissionError();
  const organizationId = membership.organizationId;
  const company = await db.company.findFirst({
    where: { id: companyId, organizationId },
    select: { id: true, organizationId: true },
  });
  if (!company || company.id !== companyId || company.organizationId !== organizationId)
    throw new CompanyNotFoundError();
  // All versions, including archives, are exported as sources, not current decisions.
  const sessionSelect = {
    id: true,
    status: true,
    version: true,
    createdAt: true,
    updatedAt: true,
    completedAt: true,
    validatedAt: true,
    archivedAt: true,
  } as const;
  const discoverySessions = bounded(
    await db.discoverySession.findMany({
      where: { organizationId, companyId },
      select: sessionSelect,
      orderBy: { id: "asc" },
      take: limit + 1,
    }),
  );
  const interviewSessions = bounded(
    await db.interviewSession.findMany({
      where: { organizationId, companyId },
      select: { ...sessionSelect, discoverySessionId: true },
      orderBy: { id: "asc" },
      take: limit + 1,
    }),
  );
  const discoveryIds = discoverySessions.map((session) => session.id);
  const interviewIds = interviewSessions.map((session) => session.id);
  const discoveryAnswers = discoveryIds.length
    ? bounded(
        await db.discoveryAnswer.findMany({
          where: { organizationId, discoverySessionId: { in: discoveryIds } },
          select: {
            discoverySessionId: true,
            step: true,
            fieldKey: true,
            valueJson: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { id: "asc" },
          take: limit + 1,
        }),
      )
    : [];
  const interviewAnswers = interviewIds.length
    ? bounded(
        await db.interviewAnswer.findMany({
          where: { organizationId, interviewSessionId: { in: interviewIds } },
          select: {
            interviewSessionId: true,
            questionId: true,
            valueJson: true,
            skipReason: true,
            confidence: true,
            revision: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { id: "asc" },
          take: limit + 1,
        }),
      )
    : [];
  const interviewEvidence = interviewIds.length
    ? bounded(
        await db.interviewEvidence.findMany({
          where: { organizationId, interviewSessionId: { in: interviewIds } },
          select: {
            interviewSessionId: true,
            domain: true,
            factKey: true,
            sourceType: true,
            sourceId: true,
            confidence: true,
            valueJson: true,
            createdAt: true,
          },
          orderBy: { id: "asc" },
          take: limit + 1,
        }),
      )
    : [];
  return {
    formatVersion: 1,
    scope: "audit_sources_only",
    companyId,
    description:
      "Sources de compréhension et d’entretien, toutes versions. Pas un export complet du compte ni un rapport de décisions actuelles.",
    excluded: [
      "company_profile",
      "documents_and_acquired_evidence",
      "derived_results_and_roi",
      "legacy_questionnaire_audits",
      "auth",
      "provider_logs",
      "backups",
    ],
    discoverySessions,
    discoveryAnswers,
    interviewSessions,
    interviewAnswers,
    interviewEvidence,
  };
}

function bounded<T>(rows: T[]): T[] {
  // Refuse an incomplete download instead of silently truncating it.
  if (rows.length > limit) throw new ExportLimitError();
  return rows;
}
