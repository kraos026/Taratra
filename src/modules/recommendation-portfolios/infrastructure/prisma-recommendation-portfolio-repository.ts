import { Prisma } from "@/generated/prisma/client";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import { RecommendationPortfolioConflictError } from "../application/recommendation-errors";
import type {
  Category,
  PriorityDefinition,
  RecommendationInput,
  RecommendationPortfolioEngine,
  RecommendationRule,
} from "../domain/recommendation-engine";
type Result = ReturnType<RecommendationPortfolioEngine["generate"]>;
const SEVERITY = { critical: 100, high: 75, medium: 50, low: 25, information: 10 };
const latest = <T extends { code: string }>(rows: T[]) => {
  const map = new Map<string, T>();
  for (const row of rows) if (!map.has(row.code)) map.set(row.code, row);
  return [...map.values()];
};
export class PrismaRecommendationPortfolioRepository {
  constructor(private readonly db: TransactionClient) {}
  context(userId: string) {
    return this.db.organizationMember.findFirst({
      where: { userId },
      select: { organizationId: true, role: true },
    });
  }
  snapshot(organizationId: string, id: string) {
    return this.db.recommendationPortfolioSnapshot.findFirst({ where: { organizationId, id } });
  }
  roiSnapshot(organizationId: string, id: string) {
    return this.db.roiEvaluationSnapshot.findFirst({
      where: { organizationId, id, status: "published" },
    });
  }
  async input(organizationId: string, roiId: string): Promise<RecommendationInput | null> {
    const roi = await this.roiSnapshot(organizationId, roiId);
    if (!roi) return null;
    const [automation, ai, analysis, process, scenario, rules, definitions] = await Promise.all([
      this.db.automationOpportunitySnapshot.findFirst({
        where: { organizationId, id: roi.automationOpportunitySnapshotId, status: "published" },
      }),
      this.db.aiOpportunitySnapshot.findFirst({
        where: { organizationId, id: roi.aiOpportunitySnapshotId, status: "published" },
      }),
      this.db.analysisSnapshot.findFirst({
        where: { organizationId, id: roi.businessAnalysisId, status: "published" },
      }),
      this.db.processMap.findFirst({
        where: { organizationId, id: roi.processMapId, status: "published" },
      }),
      this.db.roiScenario.findFirst({
        where: { organizationId, snapshotId: roiId, type: "expected" },
      }),
      this.db.recommendationRuleCatalog.findMany({
        where: { published: true, OR: [{ organizationId: null }, { organizationId }] },
        orderBy: [{ code: "asc" }, { version: "desc" }],
      }),
      this.db.priorityDefinitionCatalog.findMany({
        where: { published: true, OR: [{ organizationId: null }, { organizationId }] },
        orderBy: [{ code: "asc" }, { version: "desc" }],
      }),
    ]);
    if (!automation || !ai || !analysis || !process || !scenario) return null;
    const [evaluations, metrics, opportunities, evidence, aiLinks, findings] = await Promise.all([
      this.db.roiEvaluation.findMany({
        where: { organizationId, snapshotId: roiId, scenarioId: scenario.id },
      }),
      this.db.roiMetric.findMany({
        where: { organizationId, snapshotId: roiId, scenarioId: scenario.id },
      }),
      this.db.automationOpportunity.findMany({
        where: { organizationId, snapshotId: automation.id },
      }),
      this.db.roiEvidence.findMany({ where: { organizationId, snapshotId: roiId } }),
      this.db.automationOpportunityAiLink.findMany({
        where: { organizationId, snapshotId: automation.id },
      }),
      this.db.businessFinding.findMany({
        where: { organizationId, analysisSnapshotId: analysis.id },
      }),
    ]);
    const findingMap = new Map(findings.map((item) => [item.id, item]));
    const metric = (evaluationId: string, code: string) =>
      metrics.find((item) => item.evaluationId === evaluationId && item.code === code);
    return {
      roiSnapshotId: roi.id,
      roiStatus: roi.status,
      automationSnapshotId: automation.id,
      automationStatus: automation.status,
      aiStatus: ai.status,
      analysisStatus: analysis.status,
      processStatus: process.status,
      knowledgeSnapshotId: roi.knowledgeSnapshotId,
      candidates: evaluations.flatMap((evaluation) => {
        const opportunity = opportunities.find(
          (item) => item.id === evaluation.automationOpportunityId,
        );
        if (!opportunity) return [];
        const linkedEvidence = evidence.filter((item) => item.evaluationId === evaluation.id);
        const relatedFindings = linkedEvidence
          .map((item) => findingMap.get(item.businessFindingId))
          .filter((item): item is NonNullable<typeof item> => Boolean(item));
        const value = (code: string) => metric(evaluation.id, code);
        return [
          {
            id: opportunity.id,
            identifier: opportunity.identifier,
            title: opportunity.title,
            description: opportunity.description,
            businessProblem: opportunity.businessProblem,
            roiEvaluationId: evaluation.id,
            roiScenarioId: scenario.id,
            metricCount: metrics.filter((item) => item.evaluationId === evaluation.id).length,
            roi:
              value("roi_percentage")?.value === null
                ? null
                : Number(value("roi_percentage")?.value),
            roiSpecialValue: value("roi_percentage")?.specialValue ?? null,
            implementationCost: Number(value("implementation_cost")?.value ?? 0),
            payback:
              value("payback_period")?.value === null
                ? null
                : Number(value("payback_period")?.value),
            annualBenefit: Number(value("annual_benefit")?.value ?? 0),
            businessImpact: Number(opportunity.businessImpact),
            feasibility: Number(opportunity.technicalFeasibility),
            complexity: Number(opportunity.complexityScore),
            confidence: (Number(opportunity.confidence) + Number(evaluation.confidence)) / 2,
            operationalRisk: relatedFindings.length
              ? Math.max(...relatedFindings.map((item) => SEVERITY[item.severity]))
              : 0,
            automationReadiness: Number(opportunity.automationReadiness),
            hasAi: aiLinks.some((item) => item.opportunityId === opportunity.id),
            findingCategories: [...new Set(relatedFindings.map((item) => item.category))],
            evidence: linkedEvidence.map((item) => ({
              id: item.id,
              businessFindingId: item.businessFindingId,
              knowledgeFactId: item.knowledgeFactId,
            })),
            processIds: opportunity.affectedProcessIds,
            departmentIds: opportunity.affectedDepartmentIds,
            systemIds: opportunity.affectedSystemIds,
          },
        ];
      }),
      rules: latest(rules).map((item): RecommendationRule => {
        const match = item.matchJson as { precedence: number; initiative: string; benefit: string };
        return {
          id: item.id,
          code: item.code,
          version: item.version,
          title: item.title,
          description: item.description,
          category: item.category as Category,
          precedence: match.precedence,
          dependencies: item.dependencies as string[],
          initiativeTemplate: match.initiative,
          benefitTemplate: match.benefit,
        };
      }),
      priorityDefinitions: latest(definitions).map((item): PriorityDefinition => ({
        id: item.id,
        code: item.code,
        version: item.version,
        formula: item.formulaJson as Record<string, number>,
        thresholds: item.thresholdsJson as PriorityDefinition["thresholds"],
      })),
    };
  }
  async detail(organizationId: string, id: string) {
    const snapshot = await this.snapshot(organizationId, id);
    if (!snapshot) return null;
    const [recommendations, dependencies, evidence, contributions, validations] = await Promise.all(
      [
        this.db.transformationRecommendation.findMany({
          where: { organizationId, snapshotId: id },
          orderBy: [{ roadmapPhase: "asc" }, { priorityScore: "desc" }],
        }),
        this.db.transformationRecommendationDependency.findMany({
          where: { organizationId, snapshotId: id },
        }),
        this.db.transformationRecommendationEvidence.findMany({
          where: { organizationId, snapshotId: id },
        }),
        this.db.transformationRecommendationContribution.findMany({
          where: { organizationId, snapshotId: id },
        }),
        this.db.recommendationPortfolioValidation.findMany({
          where: { organizationId, snapshotId: id },
        }),
      ],
    );
    return { snapshot, recommendations, dependencies, evidence, contributions, validations };
  }
  async list(
    organizationId: string,
    companyId: string,
    query: {
      page: number;
      pageSize: number;
      status?: string;
      priority?: string;
      category?: string;
      phase?: string;
    },
  ) {
    const where = {
      organizationId,
      companyId,
      ...(query.status ? { status: query.status as "draft" } : {}),
    };
    const [items, total] = await Promise.all([
      this.db.recommendationPortfolioSnapshot.findMany({
        where,
        orderBy: { versionNumber: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.recommendationPortfolioSnapshot.count({ where }),
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
    input: RecommendationInput,
    result: Result,
    previousVersionId: string | null,
  ) {
    await this.db
      .$executeRaw`select pg_advisory_xact_lock(hashtextextended(${`${organizationId}:${input.roiSnapshotId}:recommendation`},0))`;
    const latestSnapshot = await this.db.recommendationPortfolioSnapshot.findFirst({
      where: { organizationId, roiSnapshotId: input.roiSnapshotId },
      orderBy: { versionNumber: "desc" },
    });
    const roi = await this.roiSnapshot(organizationId, input.roiSnapshotId);
    if (!roi) throw new Error("ROI source unavailable");
    const snapshot = await this.db.recommendationPortfolioSnapshot.create({
      data: {
        organizationId,
        companyId,
        roiSnapshotId: input.roiSnapshotId,
        automationOpportunitySnapshotId: input.automationSnapshotId,
        aiOpportunitySnapshotId: roi.aiOpportunitySnapshotId,
        businessAnalysisId: roi.businessAnalysisId,
        processMapId: roi.processMapId,
        knowledgeSnapshotId: input.knowledgeSnapshotId,
        previousVersionId,
        versionNumber: (latestSnapshot?.versionNumber ?? 0) + 1,
        catalogVersionsJson: result.catalogVersions as unknown as Prisma.InputJsonValue,
        provenanceJson: {
          roiSnapshotId: input.roiSnapshotId,
          automationSnapshotId: input.automationSnapshotId,
        } as Prisma.InputJsonValue,
        createdBy: userId,
      },
    });
    const ids = new Map<string, string>();
    for (const item of result.recommendations) {
      const row = await this.db.transformationRecommendation.create({
        data: {
          organizationId,
          snapshotId: snapshot.id,
          ruleId: item.rule.id,
          priorityDefinitionId: item.priorityDefinition.id,
          roiEvaluationId: item.candidate.roiEvaluationId,
          roiScenarioId: item.candidate.roiScenarioId,
          roiSnapshotId: input.roiSnapshotId,
          automationOpportunityId: item.candidate.id,
          automationOpportunitySnapshotId: input.automationSnapshotId,
          identifier: item.identifier,
          title: item.candidate.title,
          description: item.candidate.description,
          businessProblem: item.candidate.businessProblem,
          recommendedInitiative: item.rule.initiativeTemplate,
          expectedBenefits: [item.rule.benefitTemplate],
          implementationCost: item.candidate.implementationCost,
          expectedRoi: item.candidate.roi,
          roiSpecialValue: item.candidate.roiSpecialValue,
          payback: item.candidate.payback,
          businessImpact: item.candidate.businessImpact,
          complexity: item.candidate.complexity,
          feasibility: item.candidate.feasibility,
          operationalRisk: item.candidate.operationalRisk,
          confidence: item.candidate.confidence,
          priorityScore: item.priorityScore,
          priority: item.priority,
          category: item.category,
          roadmapPhase: item.roadmapPhase,
          affectedProcessIds: item.candidate.processIds,
          affectedDepartmentIds: item.candidate.departmentIds,
          affectedSystemIds: item.candidate.systemIds,
        },
      });
      ids.set(item.identifier, row.id);
      await this.db.transformationRecommendationContribution.createMany({
        data: item.contributions.map((c) => ({
          organizationId,
          snapshotId: snapshot.id,
          recommendationId: row.id,
          ...c,
          calculationJson: { formula: item.priorityDefinition.formula } as Prisma.InputJsonValue,
        })),
      });
      if (item.candidate.evidence.length)
        await this.db.transformationRecommendationEvidence.createMany({
          data: item.candidate.evidence.map((e) => ({
            organizationId,
            snapshotId: snapshot.id,
            recommendationId: row.id,
            roiEvidenceId: e.id,
            businessFindingId: e.businessFindingId,
            knowledgeFactId: e.knowledgeFactId,
            explanation: "Referenced published ROI evidence",
          })),
        });
    }
    for (const item of result.recommendations)
      for (const dependency of item.dependencyIdentifiers) {
        const recommendationId = ids.get(item.identifier),
          dependsOnId = ids.get(dependency);
        if (recommendationId && dependsOnId)
          await this.db.transformationRecommendationDependency.create({
            data: {
              organizationId,
              snapshotId: snapshot.id,
              recommendationId,
              dependsOnId,
              reason: `Rule ${item.rule.code} dependency`,
            },
          });
      }
    await this.db.recommendationPortfolioValidation.createMany({
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
    const changed = await this.db.recommendationPortfolioSnapshot.updateMany({
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
    if (changed.count !== 1) throw new RecommendationPortfolioConflictError();
    return this.snapshot(organizationId, id);
  }
}
