import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import { AssistedAuditService } from "@/modules/assisted-audit/application/assisted-audit-service";
import { AssistedAuditError } from "@/modules/assisted-audit/application/assisted-audit-errors";
import { PrismaAssistedAuditRepository } from "@/modules/assisted-audit/infrastructure/prisma-assisted-audit-repository";
import type {
  ExecutiveAuditResult,
  ExecutiveResultRepositoryPort,
  OpportunityDecisionSafety,
  DecisionEvidenceQuality,
} from "../application/executive-result-model";

export class PrismaExecutiveResultRepository implements ExecutiveResultRepositoryPort {
  constructor(private readonly db: TransactionClient) {}
  async read(userId: string, companyId: string): Promise<ExecutiveAuditResult | null> {
    const audit = await new AssistedAuditService(new PrismaAssistedAuditRepository(this.db), userId)
      .get(companyId)
      .catch((error: unknown) => {
        if (error instanceof AssistedAuditError && error.code === "COMPANY_NOT_FOUND") return null;
        throw error;
      });
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
    const knowledgeRef = ref("KNOWLEDGE");
    const [evidenceLinks, connectorLinks, detectionRules] = await Promise.all([
      this.db.automationOpportunityEvidence.findMany({ where: { organizationId, snapshotId: automationRef.id } }),
      this.db.automationOpportunityConnector.findMany({ where: { organizationId, snapshotId: automationRef.id } }),
      this.db.automationDetectionRuleCatalog.findMany({ where: { id: { in: opportunities.map(item => item.detectionRuleId) } } }),
    ]);
    const factIds = [...new Set(evidenceLinks.map(item => item.knowledgeFactId))];
    const [facts, evidenceRecords] = knowledgeRef ? await Promise.all([
      this.db.knowledgeFact.findMany({ where: { organizationId, snapshotId: knowledgeRef.id, id: { in: factIds } } }),
      this.db.knowledgeEvidence.findMany({ where: { organizationId, snapshotId: knowledgeRef.id, factId: { in: factIds } } }),
    ]) : [[], []];
    const safetyFor = (opportunity: typeof opportunities[number]): OpportunityDecisionSafety => {
      const links = evidenceLinks.filter(link => link.opportunityId === opportunity.id && findings.some(finding => finding.id === link.businessFindingId));
      const linkedFacts = facts.filter(fact => links.some(link => link.knowledgeFactId === fact.id));
      const qualityFor = (fact: typeof facts[number]): DecisionEvidenceQuality => {
        const evidence = evidenceRecords.filter(record => record.factId === fact.id);
        if (!evidence.length) return "MISSING";
        if (evidence.some(record => /contradict/i.test(record.evidenceType))) return "CONTRADICTORY";
        if (evidence.some(record => /assum/i.test(record.evidenceType))) return "ASSUMED";
        return Number(fact.confidencePercentage) >= 70 && evidence.every(record => ["validated_entity", "validated_answer"].includes(record.evidenceType) && Number(record.confidencePercentage) >= 70) ? "SUPPORTED" : "INFERRED";
      };
      const connectors = connectorLinks.filter(link => link.opportunityId === opportunity.id);
      const prerequisites: OpportunityDecisionSafety["prerequisites"] = connectors.map(link => ({
        id: link.connectorId, opportunityId: opportunity.id, kind: "connector",
        // Catalog keyword matching proves neither live connectivity nor permission.
        satisfied: link.available ? null : false,
        remediation: link.available ? `Vérifier la connexion et les droits du connecteur ${link.connectorId}.` : `Rendre disponible le connecteur ${link.connectorId} avant mise en œuvre.`,
      }));
      const rule = detectionRules.find(item => item.id === opportunity.detectionRuleId);
      const required = rule && Array.isArray(rule.connectorCodes) ? rule.connectorCodes : null;
      if (!required || required.length !== connectors.length) prerequisites.push({ id: "connector_checklist", opportunityId: opportunity.id, kind: "connector", satisfied: null, remediation: "Compléter la liste des connecteurs requis et vérifier leur disponibilité." });
      if (linkedFacts.some(fact => ["finance", "hr", "legal", "compliance"].includes(fact.domain))) prerequisites.push({ id: "human_approval", opportunityId: opportunity.id, kind: "human_approval", satisfied: null, remediation: "Conserver une validation humaine pour les décisions financières, sensibles ou réglementées." });
      return {
        organizationId, companyId, opportunityId: opportunity.id, automationSnapshotId: automationRef.id,
        evidence: linkedFacts.map(fact => ({ id: fact.id, quality: qualityFor(fact) })),
        observations: linkedFacts.flatMap(fact => typeof fact.valueJson === "string" || typeof fact.valueJson === "number" || typeof fact.valueJson === "boolean" ? [{ factId: fact.id, key: fact.factKey, value: fact.valueJson, quality: qualityFor(fact) }] : []),
        prerequisites,
      };
    };
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
        safety: safetyFor(item),
      })),
      roi: {
        id: roiSnapshot.id,
        currency: roiSnapshot.currency,
        evaluations: evaluations.map((item) => ({
          id: item.id,
          automationOpportunityId: item.automationOpportunityId,
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
