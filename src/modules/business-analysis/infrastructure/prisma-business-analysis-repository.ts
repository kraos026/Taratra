import { Prisma } from "@/generated/prisma/client";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import type {
  AnalysisInput,
  AnalysisRule,
  BusinessAnalysisEngine,
} from "../domain/business-analysis-engine";
import { BusinessAnalysisConflictError } from "../application/business-analysis-errors";

type AnalysisResult = ReturnType<BusinessAnalysisEngine["analyze"]>;

export class PrismaBusinessAnalysisRepository {
  constructor(private readonly db: TransactionClient) {}

  context(userId: string) {
    return this.db.organizationMember.findFirst({
      where: { userId },
      select: { organizationId: true, role: true },
    });
  }

  async input(organizationId: string, processMapId: string): Promise<AnalysisInput | null> {
    const processMap = await this.db.processMap.findFirst({
      where: { id: processMapId, organizationId, status: "published" },
    });
    if (!processMap) return null;
    const [nodes, ownership, validations, facts, rules] = await Promise.all([
      this.db.processMapNode.findMany({ where: { organizationId, processMapId } }),
      this.db.processMapOwnership.findFirst({ where: { organizationId, processMapId } }),
      this.db.processMapValidation.findMany({ where: { organizationId, processMapId } }),
      this.db.knowledgeFact.findMany({
        where: { organizationId, snapshotId: processMap.knowledgeSnapshotId },
      }),
      this.db.analysisRuleCatalog.findMany({
        where: { active: true, OR: [{ organizationId: null }, { organizationId }] },
        orderBy: [{ code: "asc" }, { version: "desc" }],
      }),
    ]);
    const latest = new Map<string, (typeof rules)[number]>();
    for (const rule of rules) if (!latest.has(rule.code)) latest.set(rule.code, rule);
    return {
      processMap: {
        id: processMap.id,
        name: processMap.name,
        status: processMap.status,
        completeness: Number(processMap.completenessPercentage),
        confidence: Number(processMap.confidencePercentage),
        coverage: Number(processMap.coveragePercentage),
        ownerId: ownership?.ownerKnowledgeNodeId ?? null,
        systemIds: ownership?.supportingSystemNodeIds ?? [],
        validationCodes: validations.map((validation) => validation.code),
      },
      nodes: nodes.map((node) => ({
        id: node.id,
        key: node.nodeKey,
        type: node.nodeType,
        name: node.name,
        description: node.description,
        executionMode: node.executionMode,
        durationMinutes: node.estimatedDurationMinutes
          ? Number(node.estimatedDurationMinutes)
          : null,
        actorId: node.actorKnowledgeNodeId,
        departmentId: node.departmentKnowledgeNodeId,
        systemId: node.systemKnowledgeNodeId,
        factIds: node.knowledgeFactIds,
      })),
      facts: facts.map((fact) => ({
        id: fact.id,
        key: fact.factKey,
        domain: fact.domain,
        value: fact.valueJson,
        confidence: Number(fact.confidencePercentage),
      })),
      rules: [...latest.values()].map((rule): AnalysisRule => ({
        id: rule.id,
        code: rule.code,
        version: rule.version,
        title: rule.title,
        description: rule.description,
        severity: rule.severity,
        category: rule.category,
        evaluationLogic: rule.evaluationLogic as Record<string, unknown>,
        explanationTemplate: rule.explanationTemplate,
        recommendationHint: rule.recommendationHint,
      })),
    };
  }

  analysis(organizationId: string, id: string) {
    return this.db.analysisSnapshot.findFirst({ where: { organizationId, id } });
  }

  processMap(organizationId: string, id: string) {
    return this.db.processMap.findFirst({
      where: { organizationId, id, status: "published" },
    });
  }

  async detail(organizationId: string, id: string) {
    const analysis = await this.analysis(organizationId, id);
    if (!analysis) return null;
    const [findings, scores, health, validations] = await Promise.all([
      this.db.businessFinding.findMany({
        where: { organizationId, analysisSnapshotId: id },
        orderBy: [{ riskPoints: "desc" }, { identifier: "asc" }],
      }),
      this.db.businessScore.findMany({ where: { organizationId, analysisSnapshotId: id } }),
      this.db.businessHealth.findMany({ where: { organizationId, analysisSnapshotId: id } }),
      this.db.analysisValidation.findMany({ where: { organizationId, analysisSnapshotId: id } }),
    ]);
    const evidence = findings.length
      ? await this.db.findingEvidence.findMany({
          where: { organizationId, analysisSnapshotId: id },
        })
      : [];
    return { analysis, findings, evidence, scores, health, validations };
  }

  async list(
    organizationId: string,
    companyId: string,
    query: {
      page: number;
      pageSize: number;
      status?: string;
      severity?: string;
      category?: string;
    },
  ) {
    const matching =
      query.severity || query.category
        ? await this.db.businessFinding.findMany({
            where: {
              organizationId,
              ...(query.severity ? { severity: query.severity as "critical" } : {}),
              ...(query.category ? { category: query.category } : {}),
            },
            select: { analysisSnapshotId: true },
            distinct: ["analysisSnapshotId"],
          })
        : null;
    const where = {
      organizationId,
      companyId,
      ...(query.status ? { status: query.status as "draft" } : {}),
      ...(matching ? { id: { in: matching.map((item) => item.analysisSnapshotId) } } : {}),
    };
    const [items, total] = await Promise.all([
      this.db.analysisSnapshot.findMany({
        where,
        orderBy: { versionNumber: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.analysisSnapshot.count({ where }),
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
    knowledgeSnapshotId: string,
    processMapId: string,
    userId: string,
    input: AnalysisInput,
    result: AnalysisResult,
    previousVersionId: string | null,
  ) {
    await this.db
      .$executeRaw`select pg_advisory_xact_lock(hashtextextended(${`${organizationId}:${processMapId}:analysis`},0))`;
    const latest = await this.db.analysisSnapshot.findFirst({
      where: { organizationId, processMapId },
      orderBy: { versionNumber: "desc" },
    });
    const analysis = await this.db.analysisSnapshot.create({
      data: {
        organizationId,
        companyId,
        knowledgeSnapshotId,
        processMapId,
        previousVersionId,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        rulesetJson: input.rules.map((rule) => ({
          id: rule.id,
          code: rule.code,
          version: rule.version,
        })) as Prisma.InputJsonValue,
        provenanceJson: {
          processMapId,
          knowledgeSnapshotId,
          findingIdentifiers: result.findings.map((finding) => finding.identifier),
        } as Prisma.InputJsonValue,
        createdBy: userId,
      },
    });
    for (const finding of result.findings) {
      const created = await this.db.businessFinding.create({
        data: {
          organizationId,
          analysisSnapshotId: analysis.id,
          ruleId: finding.rule.id,
          identifier: finding.identifier,
          title: finding.rule.title,
          description: finding.description,
          severity: finding.rule.severity,
          category: finding.rule.category,
          relatedProcessMapId: processMapId,
          relatedStepId: finding.relatedStepId,
          relatedDepartmentKnowledgeNodeId: finding.relatedDepartmentId,
          relatedActorKnowledgeNodeId: finding.relatedActorId,
          relatedSystemKnowledgeNodeId: finding.relatedSystemId,
          confidencePercentage: finding.confidence,
          businessImpact: finding.businessImpact,
          riskPoints: finding.riskPoints,
        },
      });
      if (finding.evidenceFactIds.length)
        await this.db.findingEvidence.createMany({
          data: finding.evidenceFactIds.map((knowledgeFactId) => ({
            organizationId,
            analysisSnapshotId: analysis.id,
            findingId: created.id,
            knowledgeFactId,
            evidenceType: "enterprise_knowledge_fact",
            explanation: `Rule ${finding.rule.code} v${finding.rule.version}`,
            valueJson: finding.evidence as Prisma.InputJsonValue,
          })),
        });
    }
    if (result.scores.length)
      await this.db.businessScore.createMany({
        data: result.scores.map((score) => ({
          organizationId,
          analysisSnapshotId: analysis.id,
          code: score.code,
          label: score.label,
          score: score.score,
          direction: score.direction,
          calculationJson: score.calculation as unknown as Prisma.InputJsonValue,
        })),
      });
    if (result.health.length)
      await this.db.businessHealth.createMany({
        data: result.health.map((health) => ({
          organizationId,
          analysisSnapshotId: analysis.id,
          dimension: health.dimension,
          scopeType: health.scopeType,
          scopeReferenceId: health.scopeReferenceId,
          score: health.score,
          calculationJson: health.calculation as unknown as Prisma.InputJsonValue,
        })),
      });
    if (result.validations.length)
      await this.db.analysisValidation.createMany({
        data: result.validations.map((validation) => ({
          organizationId,
          analysisSnapshotId: analysis.id,
          ...validation,
        })),
      });
    return analysis;
  }

  async transition(
    organizationId: string,
    id: string,
    lockVersion: number,
    status: "validated" | "published",
  ) {
    const changed = await this.db.analysisSnapshot.updateMany({
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
    if (changed.count !== 1) throw new BusinessAnalysisConflictError();
    return this.analysis(organizationId, id);
  }
}
