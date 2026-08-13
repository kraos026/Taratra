import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import { AssistedAuditService } from "@/modules/assisted-audit/application/assisted-audit-service";
import { PrismaAssistedAuditRepository } from "@/modules/assisted-audit/infrastructure/prisma-assisted-audit-repository";
import type {
  ExecutiveAuditResult,
  ExecutiveResultRepositoryPort,
} from "../application/executive-result-model";

export class PrismaExecutiveResultRepository implements ExecutiveResultRepositoryPort {
  constructor(private readonly db: TransactionClient) {}
  async read(userId: string, companyId: string): Promise<ExecutiveAuditResult | null> {
    const audit = await new AssistedAuditService(new PrismaAssistedAuditRepository(this.db), userId)
      .get(companyId)
      .catch(() => null);
    if (!audit) return null;
    const empty: ExecutiveAuditResult = {
      company: audit.company,
      complete: false,
      audit,
      overview: { processes: 0, findings: 0, opportunities: 0, recommendations: 0 },
      process: null,
      findings: [],
      opportunities: [],
      roi: null,
      recommendations: [],
      provenance: null,
    };
    if (audit.currentStage !== "COMPLETED") return empty;
    const ref = (stage: string) => audit.stages.find((item) => item.stage === stage)?.artifact;
    const processRef = ref("PROCESS_MAP"),
      analysisRef = ref("BUSINESS_ANALYSIS"),
      automationRef = ref("AUTOMATION_OPPORTUNITIES"),
      roiRef = ref("ROI"),
      recommendationRef = ref("RECOMMENDATIONS");
    if (!processRef || !analysisRef || !automationRef || !roiRef || !recommendationRef)
      return empty;
    const organization = await this.db.organizationMember.findFirst({
      where: { userId },
      select: { organizationId: true },
    });
    if (!organization) return null;
    const organizationId = organization.organizationId;
    const [process, findings, opportunities, roiSnapshot, scenario, recommendations] =
      await Promise.all([
        this.db.processMap.findFirst({
          where: { id: processRef.id, companyId, organizationId, status: "published" },
          select: { id: true, name: true },
        }),
        this.db.businessFinding.findMany({
          where: { analysisSnapshotId: analysisRef.id, organizationId },
          orderBy: { createdAt: "asc" },
        }),
        this.db.automationOpportunity.findMany({
          where: { snapshotId: automationRef.id, organizationId },
          orderBy: { createdAt: "asc" },
        }),
        this.db.roiEvaluationSnapshot.findFirst({
          where: { id: roiRef.id, companyId, organizationId, status: "published" },
        }),
        this.db.roiScenario.findFirst({
          where: { snapshotId: roiRef.id, organizationId, type: "expected" },
        }),
        this.db.transformationRecommendation.findMany({
          where: { snapshotId: recommendationRef.id, organizationId },
          orderBy: [{ roadmapPhase: "asc" }, { priorityScore: "desc" }],
        }),
      ]);
    if (!process || !roiSnapshot || !scenario) return empty;
    const [evaluations, metrics] = await Promise.all([
      this.db.roiEvaluation.findMany({
        where: { snapshotId: roiRef.id, scenarioId: scenario.id, organizationId },
        orderBy: { createdAt: "asc" },
      }),
      this.db.roiMetric.findMany({
        where: { snapshotId: roiRef.id, scenarioId: scenario.id, organizationId },
      }),
    ]);
    const metric = (evaluationId: string, code: string) =>
      metrics.find((item) => item.evaluationId === evaluationId && item.code === code);
    return {
      company: audit.company,
      complete: true,
      audit,
      overview: {
        processes: 1,
        findings: findings.length,
        opportunities: opportunities.length,
        recommendations: recommendations.length,
      },
      process,
      findings: findings.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        severity: item.severity,
        impact: item.businessImpact,
      })),
      opportunities: opportunities.map((item) => ({
        id: item.id,
        title: item.title,
        problem: item.businessProblem,
        impact: Number(item.businessImpact),
        readiness: Number(item.automationReadiness),
        confidence: Number(item.confidence),
      })),
      roi: {
        id: roiSnapshot.id,
        currency: roiSnapshot.currency,
        evaluations: evaluations.map((item) => ({
          id: item.id,
          title: item.title,
          annualBenefit: number(metric(item.id, "annual_benefit")?.value),
          roi: number(metric(item.id, "roi_percentage")?.value),
          roiSpecialValue: metric(item.id, "roi_percentage")?.specialValue ?? null,
          payback: number(metric(item.id, "payback_period")?.value),
        })),
      },
      recommendations: recommendations.map((item) => ({
        id: item.id,
        title: item.title,
        action: item.recommendedInitiative,
        description: item.description,
        priority: item.priority,
        phase: item.roadmapPhase,
        expectedRoi: number(item.expectedRoi),
        roiSpecialValue: item.roiSpecialValue,
        payback: number(item.payback),
        confidence: Number(item.confidence),
      })),
      provenance: {
        processMapId: processRef.id,
        analysisId: analysisRef.id,
        automationOpportunitySnapshotId: automationRef.id,
        roiId: roiRef.id,
        recommendationPortfolioId: recommendationRef.id,
      },
    };
  }
}
function number(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}
