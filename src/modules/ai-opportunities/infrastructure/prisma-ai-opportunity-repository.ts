import { Prisma } from "@/generated/prisma/client";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import type {
  AiCapabilityInput,
  AiDetectionRuleInput,
  AiOpportunityEngine,
  AiOpportunityInput,
  AiScoreDefinitionInput,
} from "../domain/ai-opportunity-engine";
import { AiOpportunityConflictError } from "../application/ai-opportunity-errors";

type DetectionResult = ReturnType<AiOpportunityEngine["detect"]>;

export class PrismaAiOpportunityRepository {
  constructor(private readonly db: TransactionClient) {}
  context(userId: string) {
    return this.db.organizationMember.findFirst({
      where: { userId },
      select: { organizationId: true, role: true },
    });
  }
  snapshot(organizationId: string, id: string) {
    return this.db.aiOpportunitySnapshot.findFirst({ where: { organizationId, id } });
  }
  analysis(organizationId: string, id: string) {
    return this.db.analysisSnapshot.findFirst({
      where: { organizationId, id, status: "published" },
    });
  }
  async input(organizationId: string, analysisId: string): Promise<AiOpportunityInput | null> {
    const analysis = await this.db.analysisSnapshot.findFirst({
      where: { organizationId, id: analysisId, status: "published" },
    });
    if (!analysis) return null;
    const processMap = await this.db.processMap.findFirst({
      where: { organizationId, id: analysis.processMapId, status: "published" },
    });
    if (!processMap || processMap.knowledgeSnapshotId !== analysis.knowledgeSnapshotId) return null;
    const [findings, findingEvidence, facts, capabilities, rules, definitions] = await Promise.all([
      this.db.businessFinding.findMany({
        where: { organizationId, analysisSnapshotId: analysisId },
      }),
      this.db.findingEvidence.findMany({
        where: { organizationId, analysisSnapshotId: analysisId },
      }),
      this.db.knowledgeFact.findMany({
        where: { organizationId, snapshotId: analysis.knowledgeSnapshotId },
      }),
      this.db.aiCapabilityCatalog.findMany({
        where: { published: true, OR: [{ organizationId: null }, { organizationId }] },
        orderBy: [{ code: "asc" }, { version: "desc" }],
      }),
      this.db.aiDetectionRuleCatalog.findMany({
        where: { active: true, OR: [{ organizationId: null }, { organizationId }] },
        orderBy: [{ code: "asc" }, { version: "desc" }],
      }),
      this.db.aiScoreDefinitionCatalog.findMany({
        where: { active: true, OR: [{ organizationId: null }, { organizationId }] },
        orderBy: [{ code: "asc" }, { version: "desc" }],
      }),
    ]);
    const latest = <T extends { code: string }>(rows: T[]) => {
      const map = new Map<string, T>();
      for (const row of rows) if (!map.has(row.code)) map.set(row.code, row);
      return [...map.values()];
    };
    const factsByFinding = new Map<string, string[]>();
    for (const evidence of findingEvidence)
      factsByFinding.set(evidence.findingId, [
        ...(factsByFinding.get(evidence.findingId) ?? []),
        evidence.knowledgeFactId,
      ]);
    return {
      analysisId,
      analysisStatus: analysis.status,
      processMapId: processMap.id,
      processMapStatus: processMap.status,
      processName: processMap.name,
      processConfidence: Number(processMap.confidencePercentage),
      knowledgeSnapshotId: analysis.knowledgeSnapshotId,
      findings: findings.map((finding) => ({
        id: finding.id,
        identifier: finding.identifier,
        ruleCode: finding.identifier.split(":")[0]!,
        severity: finding.severity,
        confidence: Number(finding.confidencePercentage),
        processId: finding.relatedProcessMapId,
        departmentId: finding.relatedDepartmentKnowledgeNodeId,
        systemId: finding.relatedSystemKnowledgeNodeId,
        factIds: factsByFinding.get(finding.id) ?? [],
      })),
      facts: facts.map((fact) => ({
        id: fact.id,
        key: fact.factKey,
        domain: fact.domain,
        value: fact.valueJson,
        confidence: Number(fact.confidencePercentage),
      })),
      capabilities: latest(capabilities).map((row): AiCapabilityInput => ({
        id: row.id,
        code: row.code,
        version: row.version,
        title: row.title,
        description: row.description,
        requiredData: row.requiredData as string[],
        expectedOutputs: row.expectedOutputs as string[],
        limitations: row.limitations as string[],
        complexity: row.implementationComplexity,
      })),
      detectionRules: latest(rules).map((row): AiDetectionRuleInput => ({
        id: row.id,
        code: row.code,
        version: row.version,
        title: row.title,
        findingCodes: row.findingCodes as string[],
        processTerms: row.processTerms as string[],
        knowledgeTerms: row.knowledgeTerms as string[],
        capabilityCodes: row.capabilityCodes as string[],
        businessProblem: row.businessProblemTemplate,
        impact: row.impactTemplate,
        risk: row.risk,
      })),
      scoreDefinitions: latest(definitions).map((row): AiScoreDefinitionInput => ({
        id: row.id,
        code: row.code,
        version: row.version,
        formula: row.formulaJson as Record<string, unknown>,
      })),
    };
  }
  async detail(organizationId: string, id: string) {
    const snapshot = await this.snapshot(organizationId, id);
    if (!snapshot) return null;
    const opportunities = await this.db.aiOpportunity.findMany({
      where: { organizationId, snapshotId: id },
      orderBy: [{ businessImpact: "desc" }, { identifier: "asc" }],
    });
    const ids = opportunities.map((item) => item.id);
    const [capabilities, evidence, scores, prerequisites, validations] = await Promise.all([
      this.db.aiOpportunityCapability.findMany({
        where: { organizationId, snapshotId: id, opportunityId: { in: ids } },
      }),
      this.db.aiOpportunityEvidence.findMany({ where: { organizationId, snapshotId: id } }),
      this.db.aiOpportunityScore.findMany({ where: { organizationId, snapshotId: id } }),
      this.db.aiOpportunityPrerequisite.findMany({ where: { organizationId, snapshotId: id } }),
      this.db.aiOpportunityValidation.findMany({ where: { organizationId, snapshotId: id } }),
    ]);
    const capabilityCatalog = await this.db.aiCapabilityCatalog.findMany({
      where: { id: { in: capabilities.map((item) => item.capabilityId) } },
    });
    return {
      snapshot,
      opportunities,
      capabilities,
      capabilityCatalog,
      evidence,
      scores,
      prerequisites,
      validations,
    };
  }
  async list(
    organizationId: string,
    companyId: string,
    query: { page: number; pageSize: number; status?: string; capability?: string; risk?: string },
  ) {
    let ids: string[] | undefined;
    if (query.capability || query.risk) {
      const opportunities = await this.db.aiOpportunity.findMany({
        where: { organizationId, ...(query.risk ? { risk: query.risk as "low" } : {}) },
        select: { snapshotId: true, id: true },
      });
      let filtered = opportunities;
      if (query.capability) {
        const capability = await this.db.aiCapabilityCatalog.findFirst({
          where: { code: query.capability, OR: [{ organizationId: null }, { organizationId }] },
        });
        if (!capability) filtered = [];
        else {
          const links = await this.db.aiOpportunityCapability.findMany({
            where: {
              organizationId,
              capabilityId: capability.id,
              opportunityId: { in: opportunities.map((item) => item.id) },
            },
            select: { opportunityId: true },
          });
          const linked = new Set(links.map((link) => link.opportunityId));
          filtered = opportunities.filter((item) => linked.has(item.id));
        }
      }
      ids = [...new Set(filtered.map((item) => item.snapshotId))];
    }
    const where = {
      organizationId,
      companyId,
      ...(query.status ? { status: query.status as "draft" } : {}),
      ...(ids ? { id: { in: ids } } : {}),
    };
    const [items, total] = await Promise.all([
      this.db.aiOpportunitySnapshot.findMany({
        where,
        orderBy: { versionNumber: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.aiOpportunitySnapshot.count({ where }),
    ]);
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }
  async persist(
    organizationId: string,
    companyId: string,
    userId: string,
    input: AiOpportunityInput,
    result: DetectionResult,
    previousVersionId: string | null,
  ) {
    await this.db
      .$executeRaw`select pg_advisory_xact_lock(hashtextextended(${`${organizationId}:${input.analysisId}:ai-opportunity`},0))`;
    const latest = await this.db.aiOpportunitySnapshot.findFirst({
      where: { organizationId, businessAnalysisId: input.analysisId },
      orderBy: { versionNumber: "desc" },
    });
    const snapshot = await this.db.aiOpportunitySnapshot.create({
      data: {
        organizationId,
        companyId,
        businessAnalysisId: input.analysisId,
        processMapId: input.processMapId,
        knowledgeSnapshotId: input.knowledgeSnapshotId,
        previousVersionId,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        catalogVersionsJson: result.catalogVersions as unknown as Prisma.InputJsonValue,
        provenanceJson: {
          businessAnalysisId: input.analysisId,
          processMapId: input.processMapId,
          knowledgeSnapshotId: input.knowledgeSnapshotId,
        } as Prisma.InputJsonValue,
        createdBy: userId,
      },
    });
    for (const item of result.opportunities) {
      const opportunity = await this.db.aiOpportunity.create({
        data: {
          organizationId,
          snapshotId: snapshot.id,
          detectionRuleId: item.rule.id,
          identifier: item.identifier,
          title: item.title,
          description: item.description,
          businessProblem: item.businessProblem,
          confidence: item.confidence,
          feasibility: item.feasibility,
          businessImpact: item.businessImpact,
          technicalComplexity: item.technicalComplexity,
          dataReadiness: item.dataReadiness,
          aiReadiness: item.aiReadiness,
          implementationEffort: item.implementationEffort,
          risk: item.risk,
          affectedProcessIds: item.processIds,
          affectedDepartmentIds: item.departmentIds,
          affectedSystemIds: item.systemIds,
        },
      });
      await this.db.aiOpportunityCapability.createMany({
        data: item.capabilities.map((capability) => ({
          organizationId,
          snapshotId: snapshot.id,
          opportunityId: opportunity.id,
          capabilityId: capability.id,
        })),
      });
      const evidenceRows = item.findings.flatMap((finding) =>
        item.evidenceFacts
          .filter((fact) => finding.factIds.includes(fact.id))
          .map((fact) => ({
            organizationId,
            snapshotId: snapshot.id,
            opportunityId: opportunity.id,
            businessFindingId: finding.id,
            knowledgeFactId: fact.id,
            explanation: `Rule ${item.rule.code} v${item.rule.version}`,
            evidenceJson: { finding: finding.identifier, fact: fact.key } as Prisma.InputJsonValue,
          })),
      );
      if (evidenceRows.length)
        await this.db.aiOpportunityEvidence.createMany({ data: evidenceRows });
      await this.db.aiOpportunityScore.createMany({
        data: item.scores.map((score) => ({
          organizationId,
          snapshotId: snapshot.id,
          opportunityId: opportunity.id,
          scoreDefinitionId: score.definition.id,
          score: score.score,
          calculationJson: score.calculation as Prisma.InputJsonValue,
        })),
      });
      if (item.prerequisites.length)
        await this.db.aiOpportunityPrerequisite.createMany({
          data: item.prerequisites.map((p) => ({
            organizationId,
            snapshotId: snapshot.id,
            opportunityId: opportunity.id,
            code: p.code,
            description: p.description,
            satisfied: p.satisfied,
          })),
        });
    }
    await this.db.aiOpportunityValidation.createMany({
      data: result.validations.map((validation) => ({
        organizationId,
        snapshotId: snapshot.id,
        ...validation,
      })),
    });
    return snapshot;
  }
  async transition(
    organizationId: string,
    id: string,
    lockVersion: number,
    status: "validated" | "published",
  ) {
    const changed = await this.db.aiOpportunitySnapshot.updateMany({
      where: {
        organizationId,
        id,
        lockVersion,
        status: status === "validated" ? "draft" : "validated",
      },
      data: {
        status,
        lockVersion: { increment: 1 },
        ...(status === "validated" ? { validatedAt: new Date() } : { publishedAt: new Date() }),
      },
    });
    if (changed.count !== 1) throw new AiOpportunityConflictError();
    return this.snapshot(organizationId, id);
  }
}
