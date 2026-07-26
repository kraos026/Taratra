import { Prisma } from "@/generated/prisma/client";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import { AutomationOpportunityConflictError } from "../application/automation-opportunity-errors";
import type {
  AutomationConnector,
  AutomationInput,
  AutomationOpportunityEngine,
  AutomationPattern,
  AutomationRule,
  AutomationScoreDefinition,
} from "../domain/automation-opportunity-engine";

type Result = ReturnType<AutomationOpportunityEngine["detect"]>;
const latest = <T extends { code: string }>(rows: T[]) => {
  const values = new Map<string, T>();
  for (const row of rows) if (!values.has(row.code)) values.set(row.code, row);
  return [...values.values()];
};

export class PrismaAutomationOpportunityRepository {
  constructor(private readonly db: TransactionClient) {}
  context(userId: string) {
    return this.db.organizationMember.findFirst({
      where: { userId },
      select: { organizationId: true, role: true },
    });
  }
  snapshot(organizationId: string, id: string) {
    return this.db.automationOpportunitySnapshot.findFirst({ where: { organizationId, id } });
  }
  aiSnapshot(organizationId: string, id: string) {
    return this.db.aiOpportunitySnapshot.findFirst({
      where: { organizationId, id, status: "published" },
    });
  }
  async input(organizationId: string, aiSnapshotId: string): Promise<AutomationInput | null> {
    const ai = await this.aiSnapshot(organizationId, aiSnapshotId);
    if (!ai) return null;
    const [
      analysis,
      processMap,
      knowledge,
      findings,
      findingEvidence,
      facts,
      aiOpportunities,
      aiLinks,
      patterns,
      connectors,
      rules,
      definitions,
    ] = await Promise.all([
      this.db.analysisSnapshot.findFirst({
        where: { organizationId, id: ai.businessAnalysisId, status: "published" },
      }),
      this.db.processMap.findFirst({
        where: { organizationId, id: ai.processMapId, status: "published" },
      }),
      this.db.knowledgeSnapshot.findFirst({
        where: { organizationId, id: ai.knowledgeSnapshotId, status: "ready" },
      }),
      this.db.businessFinding.findMany({
        where: { organizationId, analysisSnapshotId: ai.businessAnalysisId },
      }),
      this.db.findingEvidence.findMany({
        where: { organizationId, analysisSnapshotId: ai.businessAnalysisId },
      }),
      this.db.knowledgeFact.findMany({
        where: { organizationId, snapshotId: ai.knowledgeSnapshotId },
      }),
      this.db.aiOpportunity.findMany({ where: { organizationId, snapshotId: aiSnapshotId } }),
      this.db.aiOpportunityCapability.findMany({
        where: { organizationId, snapshotId: aiSnapshotId },
      }),
      this.db.automationPatternCatalog.findMany({
        where: { published: true, OR: [{ organizationId: null }, { organizationId }] },
        orderBy: [{ code: "asc" }, { version: "desc" }],
      }),
      this.db.automationConnectorCatalog.findMany({
        where: { published: true, OR: [{ organizationId: null }, { organizationId }] },
        orderBy: [{ code: "asc" }, { version: "desc" }],
      }),
      this.db.automationDetectionRuleCatalog.findMany({
        where: { active: true, OR: [{ organizationId: null }, { organizationId }] },
        orderBy: [{ code: "asc" }, { version: "desc" }],
      }),
      this.db.automationScoreDefinitionCatalog.findMany({
        where: { active: true, OR: [{ organizationId: null }, { organizationId }] },
        orderBy: [{ code: "asc" }, { version: "desc" }],
      }),
    ]);
    if (
      !analysis ||
      !processMap ||
      !knowledge ||
      analysis.processMapId !== processMap.id ||
      analysis.knowledgeSnapshotId !== knowledge.id
    )
      return null;
    const factsByFinding = new Map<string, string[]>();
    for (const evidence of findingEvidence)
      factsByFinding.set(evidence.findingId, [
        ...(factsByFinding.get(evidence.findingId) ?? []),
        evidence.knowledgeFactId,
      ]);
    const capabilitiesByOpportunity = new Map<string, string[]>();
    const capabilityIds = [...new Set(aiLinks.map((item) => item.capabilityId))];
    const capabilityCatalog = await this.db.aiCapabilityCatalog.findMany({
      where: { id: { in: capabilityIds } },
    });
    const capabilityCode = new Map(capabilityCatalog.map((item) => [item.id, item.code]));
    for (const link of aiLinks)
      capabilitiesByOpportunity.set(
        link.opportunityId,
        [
          ...(capabilitiesByOpportunity.get(link.opportunityId) ?? []),
          capabilityCode.get(link.capabilityId)!,
        ].filter(Boolean),
      );
    return {
      aiSnapshotId,
      aiSnapshotStatus: ai.status,
      analysisId: analysis.id,
      analysisStatus: analysis.status,
      processMapId: processMap.id,
      processMapStatus: processMap.status,
      knowledgeSnapshotId: knowledge.id,
      findings: findings.map((item) => ({
        id: item.id,
        code: item.identifier.split(":")[0]!,
        severity: item.severity,
        confidence: Number(item.confidencePercentage),
        processId: item.relatedProcessMapId,
        departmentId: item.relatedDepartmentKnowledgeNodeId,
        systemId: item.relatedSystemKnowledgeNodeId,
        factIds: factsByFinding.get(item.id) ?? [],
      })),
      facts: facts.map((item) => ({
        id: item.id,
        key: item.factKey,
        domain: item.domain,
        value: item.valueJson,
        confidence: Number(item.confidencePercentage),
      })),
      aiOpportunities: aiOpportunities.map((item) => ({
        id: item.id,
        capabilityCodes: capabilitiesByOpportunity.get(item.id) ?? [],
        confidence: Number(item.confidence),
      })),
      patterns: latest(patterns).map((item): AutomationPattern => ({
        id: item.id,
        code: item.code,
        version: item.version,
        title: item.title,
        description: item.description,
        outputs: item.outputs as string[],
        complexity: item.complexity,
      })),
      connectors: latest(connectors).map((item): AutomationConnector => ({
        id: item.id,
        code: item.code,
        version: item.version,
        title: item.title,
        aliases: item.aliases as string[],
      })),
      rules: latest(rules).map((item): AutomationRule => ({
        id: item.id,
        code: item.code,
        version: item.version,
        title: item.title,
        findingCodes: item.findingCodes as string[],
        aiCapabilityCodes: item.aiCapabilityCodes as string[],
        patternCode: item.patternCode,
        connectorCodes: item.connectorCodes as string[],
        triggerType: item.triggerType,
        actions: item.actions as string[],
        businessProblem: item.businessProblemTemplate,
        impact: item.impactTemplate,
      })),
      scoreDefinitions: latest(definitions).map((item): AutomationScoreDefinition => ({
        id: item.id,
        code: item.code,
        version: item.version,
        formula: item.formulaJson as Record<string, unknown>,
      })),
    };
  }
  async detail(organizationId: string, id: string) {
    const snapshot = await this.snapshot(organizationId, id);
    if (!snapshot) return null;
    const opportunities = await this.db.automationOpportunity.findMany({
      where: { organizationId, snapshotId: id },
      orderBy: [{ businessImpact: "desc" }, { identifier: "asc" }],
    });
    const ids = opportunities.map((item) => item.id);
    const [connectors, aiLinks, evidence, scores, validations, patterns] = await Promise.all([
      this.db.automationOpportunityConnector.findMany({
        where: { organizationId, snapshotId: id, opportunityId: { in: ids } },
      }),
      this.db.automationOpportunityAiLink.findMany({ where: { organizationId, snapshotId: id } }),
      this.db.automationOpportunityEvidence.findMany({ where: { organizationId, snapshotId: id } }),
      this.db.automationOpportunityScore.findMany({ where: { organizationId, snapshotId: id } }),
      this.db.automationOpportunityValidation.findMany({
        where: { organizationId, snapshotId: id },
      }),
      this.db.automationPatternCatalog.findMany({
        where: { id: { in: opportunities.map((item) => item.patternId) } },
      }),
    ]);
    return {
      snapshot,
      opportunities,
      connectors,
      aiLinks,
      evidence,
      scores,
      validations,
      patterns,
    };
  }
  async list(
    organizationId: string,
    companyId: string,
    query: {
      page: number;
      pageSize: number;
      status?: string;
      pattern?: string;
      connector?: string;
    },
  ) {
    const where = {
      organizationId,
      companyId,
      ...(query.status ? { status: query.status as "draft" } : {}),
    };
    const [items, total] = await Promise.all([
      this.db.automationOpportunitySnapshot.findMany({
        where,
        orderBy: { versionNumber: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.automationOpportunitySnapshot.count({ where }),
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
    input: AutomationInput,
    result: Result,
    previousVersionId: string | null,
  ) {
    await this.db
      .$executeRaw`select pg_advisory_xact_lock(hashtextextended(${`${organizationId}:${input.aiSnapshotId}:automation-opportunity`},0))`;
    const latestSnapshot = await this.db.automationOpportunitySnapshot.findFirst({
      where: { organizationId, aiOpportunitySnapshotId: input.aiSnapshotId },
      orderBy: { versionNumber: "desc" },
    });
    const snapshot = await this.db.automationOpportunitySnapshot.create({
      data: {
        organizationId,
        companyId,
        aiOpportunitySnapshotId: input.aiSnapshotId,
        businessAnalysisId: input.analysisId,
        processMapId: input.processMapId,
        knowledgeSnapshotId: input.knowledgeSnapshotId,
        previousVersionId,
        versionNumber: (latestSnapshot?.versionNumber ?? 0) + 1,
        catalogVersionsJson: result.catalogVersions as unknown as Prisma.InputJsonValue,
        provenanceJson: {
          aiOpportunitySnapshotId: input.aiSnapshotId,
          businessAnalysisId: input.analysisId,
          processMapId: input.processMapId,
          knowledgeSnapshotId: input.knowledgeSnapshotId,
        } as Prisma.InputJsonValue,
        createdBy: userId,
      },
    });
    for (const item of result.opportunities) {
      const opportunity = await this.db.automationOpportunity.create({
        data: {
          organizationId,
          snapshotId: snapshot.id,
          detectionRuleId: item.rule.id,
          patternId: item.pattern.id,
          identifier: item.identifier,
          title: item.title,
          description: item.description,
          businessProblem: item.businessProblem,
          triggerType: item.triggerType,
          actionsJson: item.actions,
          outputsJson: item.outputs,
          businessImpact: item.businessImpact,
          automationCoverage: item.automationCoverage,
          technicalFeasibility: item.technicalFeasibility,
          connectorAvailability: item.connectorAvailability,
          automationReadiness: item.automationReadiness,
          complexityScore: item.complexity,
          confidence: item.confidence,
          implementationEffort: item.implementationEffort,
          affectedProcessIds: item.processIds,
          affectedDepartmentIds: item.departmentIds,
          affectedSystemIds: item.systemIds,
        },
      });
      await this.db.automationOpportunityConnector.createMany({
        data: item.connectors
          .filter((link) => link.connector)
          .map((link) => ({
            organizationId,
            snapshotId: snapshot.id,
            opportunityId: opportunity.id,
            connectorId: link.connector!.id,
            available: link.available,
            evidenceJson: { deterministicMatch: link.available },
          })),
      });
      if (item.aiLinks.length)
        await this.db.automationOpportunityAiLink.createMany({
          data: item.aiLinks.map((link) => ({
            organizationId,
            snapshotId: snapshot.id,
            aiOpportunitySnapshotId: input.aiSnapshotId,
            opportunityId: opportunity.id,
            aiOpportunityId: link.id,
          })),
        });
      const evidence = item.findings.flatMap((finding) =>
        item.evidence
          .filter((fact) => finding.factIds.includes(fact.id))
          .map((fact) => ({
            organizationId,
            snapshotId: snapshot.id,
            opportunityId: opportunity.id,
            businessFindingId: finding.id,
            knowledgeFactId: fact.id,
            explanation: `Rule ${item.rule.code} v${item.rule.version}`,
            evidenceJson: { fact: fact.key },
          })),
      );
      if (evidence.length)
        await this.db.automationOpportunityEvidence.createMany({ data: evidence });
      await this.db.automationOpportunityScore.createMany({
        data: item.scores.map((score) => ({
          organizationId,
          snapshotId: snapshot.id,
          opportunityId: opportunity.id,
          scoreDefinitionId: score.definition.id,
          score: score.score,
          calculationJson: score.calculation as Prisma.InputJsonValue,
        })),
      });
    }
    await this.db.automationOpportunityValidation.createMany({
      data: result.validations.map((item) => ({
        organizationId,
        snapshotId: snapshot.id,
        ...item,
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
    const changed = await this.db.automationOpportunitySnapshot.updateMany({
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
    if (changed.count !== 1) throw new AutomationOpportunityConflictError();
    return this.snapshot(organizationId, id);
  }
}
