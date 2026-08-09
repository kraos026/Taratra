import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import type {
  AssistedAuditRecord,
  AssistedAuditRepositoryPort,
  AssistedAuditRole,
  AssistedAuditState,
} from "../application/assisted-audit-port";

const lifecycleSelect = {
  id: true,
  status: true,
  lockVersion: true,
  versionNumber: true,
} as const;

export class PrismaAssistedAuditRepository implements AssistedAuditRepositoryPort {
  constructor(private readonly db: TransactionClient) {}

  async read(userId: string, companyId: string): Promise<AssistedAuditState | null> {
    const membership = await this.db.organizationMember.findFirst({
      where: { userId },
      select: { organizationId: true, role: true },
    });
    if (!membership) return null;
    const organizationId = membership.organizationId;
    const company = await this.db.company.findFirst({
      where: { id: companyId, organizationId },
      select: { id: true, name: true },
    });
    if (!company) return null;

    const discovery = await this.db.discoverySession.findFirst({
      where: { organizationId, companyId, status: { not: "archived" } },
      orderBy: { version: "desc" },
      select: { id: true, version: true, status: true, lockVersion: true },
    });
    const interview = discovery
      ? await this.db.interviewSession.findFirst({
          where: {
            organizationId,
            companyId,
            discoverySessionId: discovery.id,
            status: { not: "archived" },
          },
          orderBy: { version: "desc" },
          select: { id: true, version: true, status: true, lockVersion: true },
        })
      : null;

    const knowledge =
      discovery?.status === "validated" && interview?.status === "validated"
        ? await this.findKnowledge(organizationId, companyId, discovery, interview)
        : null;
    const processMaps = knowledge
      ? await this.db.processMap.findMany({
          where: {
            organizationId,
            companyId,
            knowledgeSnapshotId: knowledge.id,
            status: { not: "archived" },
          },
          orderBy: [{ processPatternId: "asc" }, { versionNumber: "desc" }],
          select: { ...lifecycleSelect, processPatternId: true },
        })
      : [];
    const canonicalMaps = latestProcessMapVersions(processMaps);
    const analyses = canonicalMaps.length
      ? await this.db.analysisSnapshot.findMany({
          where: {
            organizationId,
            companyId,
            processMapId: { in: canonicalMaps.map((map) => map.id) },
            status: { not: "archived" },
          },
          orderBy: [{ processMapId: "asc" }, { versionNumber: "desc" }],
          select: { ...lifecycleSelect, processMapId: true },
        })
      : [];
    const selectedProcessMap = selectProcessMap(canonicalMaps, analyses);
    const analysis = selectedProcessMap
      ? (analyses.find((candidate) => candidate.processMapId === selectedProcessMap.id) ?? null)
      : null;
    const aiOpportunities = analysis
      ? await this.db.aiOpportunitySnapshot.findFirst({
          where: {
            organizationId,
            companyId,
            businessAnalysisId: analysis.id,
            status: { not: "archived" },
          },
          orderBy: { versionNumber: "desc" },
          select: lifecycleSelect,
        })
      : null;
    const automationOpportunities = aiOpportunities
      ? await this.db.automationOpportunitySnapshot.findFirst({
          where: {
            organizationId,
            companyId,
            aiOpportunitySnapshotId: aiOpportunities.id,
            status: { not: "archived" },
          },
          orderBy: { versionNumber: "desc" },
          select: lifecycleSelect,
        })
      : null;
    const roi = automationOpportunities
      ? await this.db.roiEvaluationSnapshot.findFirst({
          where: {
            organizationId,
            companyId,
            automationOpportunitySnapshotId: automationOpportunities.id,
            status: { not: "archived" },
          },
          orderBy: { versionNumber: "desc" },
          select: lifecycleSelect,
        })
      : null;
    const recommendations = roi
      ? await this.db.recommendationPortfolioSnapshot.findFirst({
          where: {
            organizationId,
            companyId,
            roiSnapshotId: roi.id,
            status: { not: "archived" },
          },
          orderBy: { versionNumber: "desc" },
          select: lifecycleSelect,
        })
      : null;

    return {
      company,
      role: membership.role as AssistedAuditRole,
      discovery: discovery ? sessionRecord(discovery) : null,
      interview: interview ? sessionRecord(interview) : null,
      knowledge: knowledge ? knowledgeRecord(knowledge) : null,
      processMaps: processMaps.map((item) => ({
        ...versionedRecord(item),
        lineageKey: item.processPatternId,
      })),
      selectedProcessMapId: selectedProcessMap?.id ?? null,
      analysis: analysis ? versionedRecord(analysis) : null,
      aiOpportunities: aiOpportunities ? versionedRecord(aiOpportunities) : null,
      automationOpportunities: automationOpportunities
        ? versionedRecord(automationOpportunities)
        : null,
      roi: roi ? versionedRecord(roi) : null,
      recommendations: recommendations ? versionedRecord(recommendations) : null,
    };
  }

  private async findKnowledge(
    organizationId: string,
    companyId: string,
    discovery: { id: string; version: number },
    interview: { id: string; version: number },
  ) {
    const snapshots = await this.db.knowledgeSnapshot.findMany({
      where: { organizationId, companyId, status: { in: ["building", "ready", "failed"] } },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        status: true,
        createdAt: true,
      },
    });
    const expected = new Set([
      `discovery:${discovery.id}:${discovery.version}`,
      `interview:${interview.id}:${interview.version}`,
    ]);
    for (const snapshot of snapshots) {
      const sources = await this.db.knowledgeSource.findMany({
        where: { organizationId, snapshotId: snapshot.id },
        select: { sourceType: true, sourceId: true, sourceVersion: true },
      });
      if (
        sources.length === expected.size &&
        sources.every((source) =>
          expected.has(`${source.sourceType}:${source.sourceId}:${source.sourceVersion}`),
        )
      )
        return snapshot;
    }
    return null;
  }
}

function sessionRecord(row: {
  id: string;
  version: number;
  status: string;
  lockVersion: number;
}): AssistedAuditRecord {
  return { id: row.id, version: row.version, status: row.status, lockVersion: row.lockVersion };
}

function knowledgeRecord(row: {
  id: string;
  version: number;
  status: string;
}): AssistedAuditRecord {
  return { id: row.id, version: row.version, status: row.status };
}

function versionedRecord(row: {
  id: string;
  versionNumber: number;
  status: string;
  lockVersion: number;
}): AssistedAuditRecord {
  return {
    id: row.id,
    version: row.versionNumber,
    status: row.status,
    lockVersion: row.lockVersion,
  };
}

function latestProcessMapVersions<
  Record extends { processPatternId: string; versionNumber: number },
>(records: Record[]): Record[] {
  const byPattern = new Map<string, Record>();
  for (const record of records)
    if (!byPattern.has(record.processPatternId)) byPattern.set(record.processPatternId, record);
  return [...byPattern.values()];
}

function selectProcessMap<
  MapRecord extends { id: string },
  AnalysisRecord extends { processMapId: string },
>(maps: MapRecord[], analyses: AnalysisRecord[]): MapRecord | null {
  if (maps.length === 1) return maps[0]!;
  const analyzedMapIds = new Set(analyses.map((analysis) => analysis.processMapId));
  if (analyzedMapIds.size !== 1) return null;
  return maps.find((map) => analyzedMapIds.has(map.id)) ?? null;
}
