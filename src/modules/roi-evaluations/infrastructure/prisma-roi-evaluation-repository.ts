import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import { RoiConflictError } from "../application/roi-errors";
import type {
  AssumptionCode,
  RoiAssumptionDefinition,
  RoiEvaluationEngine,
  RoiInput,
  RoiModelDefinition,
} from "../domain/roi-engine";
type Result = ReturnType<RoiEvaluationEngine["evaluate"]>;
export interface RoiEvaluationDetail {
  readonly snapshot: NonNullable<Awaited<ReturnType<PrismaRoiEvaluationRepository["snapshot"]>>>;
  readonly scenarios: Awaited<ReturnType<PrismaRoiEvaluationRepository["detailScenarios"]>>;
  readonly evaluations: Awaited<ReturnType<PrismaRoiEvaluationRepository["detailEvaluations"]>>;
  readonly assumptions: Awaited<ReturnType<PrismaRoiEvaluationRepository["detailAssumptions"]>>;
  readonly contributions: Awaited<ReturnType<PrismaRoiEvaluationRepository["detailContributions"]>>;
  readonly metrics: Awaited<ReturnType<PrismaRoiEvaluationRepository["detailMetrics"]>>;
  readonly evidence: Awaited<ReturnType<PrismaRoiEvaluationRepository["detailEvidence"]>>;
  readonly validations: Awaited<ReturnType<PrismaRoiEvaluationRepository["detailValidations"]>>;
}
export interface PreparedRoiPersistencePlan {
  readonly snapshotId: string;
  readonly scenarioRows: Prisma.RoiScenarioCreateManyInput[];
  readonly assumptionRows: Prisma.RoiScenarioAssumptionCreateManyInput[];
  readonly evaluationRows: Prisma.RoiEvaluationCreateManyInput[];
  readonly contributionRows: Prisma.RoiContributionCreateManyInput[];
  readonly metricRows: Prisma.RoiMetricCreateManyInput[];
  readonly evidenceRows: Prisma.RoiEvidenceCreateManyInput[];
  readonly validationRows: Prisma.RoiValidationCreateManyInput[];
  readonly catalogVersionsJson: Prisma.InputJsonValue;
  readonly provenanceJson: Prisma.InputJsonValue;
}

const latest = <T extends { code: string }>(rows: T[]) => {
  const map = new Map<string, T>();
  for (const row of rows) if (!map.has(row.code)) map.set(row.code, row);
  return [...map.values()];
};

export function prepareRoiPersistencePlan(
  organizationId: string,
  input: RoiInput,
  result: Result,
): PreparedRoiPersistencePlan {
  const snapshotId = randomUUID();
  const scenarioRows: Prisma.RoiScenarioCreateManyInput[] = [];
  const assumptionRows: Prisma.RoiScenarioAssumptionCreateManyInput[] = [];
  const evaluationRows: Prisma.RoiEvaluationCreateManyInput[] = [];
  const contributionRows: Prisma.RoiContributionCreateManyInput[] = [];
  const metricRows: Prisma.RoiMetricCreateManyInput[] = [];
  const evidenceRows: Prisma.RoiEvidenceCreateManyInput[] = [];

  for (const scenarioResult of result.scenarios) {
    const scenarioId = randomUUID();
    scenarioRows.push({
      id: scenarioId,
      organizationId,
      snapshotId,
      type: scenarioResult.type,
      modelId: scenarioResult.model.id,
      volumeFactor: scenarioResult.volumeFactor,
      costFactor: scenarioResult.costFactor,
    });

    assumptionRows.push(
      ...scenarioResult.assumptions.map((item) => ({
        organizationId,
        snapshotId,
        scenarioId,
        assumptionId: item.definition.id,
        value: item.value,
        unit: item.definition.unit,
        source: item.source,
      })),
    );

    for (const item of scenarioResult.evaluations) {
      const evaluationId = randomUUID();
      evaluationRows.push({
        id: evaluationId,
        organizationId,
        snapshotId,
        scenarioId,
        automationOpportunityId: item.opportunity.id,
        identifier: `${item.opportunity.identifier}:${scenarioResult.type}`,
        title: item.opportunity.title,
        description: item.opportunity.description,
        confidence: item.confidence,
      });

      contributionRows.push(
        ...item.contributions.map((value) => ({
          organizationId,
          snapshotId,
          scenarioId,
          evaluationId,
          assumptionId: value.assumption.id,
          code: value.assumption.code,
          inputValue: value.inputValue,
          contribution: value.contribution,
          calculationJson: value.calculation as Prisma.InputJsonValue,
        })),
      );

      metricRows.push(
        ...item.metrics.map((metric) => ({
          organizationId,
          snapshotId,
          scenarioId,
          evaluationId,
          code: metric.code,
          value: metric.value,
          specialValue: metric.specialValue,
          unit: metric.unit,
          calculationJson: metric.calculation as Prisma.InputJsonValue,
        })),
      );

      evidenceRows.push(
        ...item.opportunity.evidence.map((value) => ({
          organizationId,
          snapshotId,
          scenarioId,
          evaluationId,
          automationEvidenceId: value.id,
          businessFindingId: value.businessFindingId,
          knowledgeFactId: value.knowledgeFactId,
          explanation: "Referenced Automation Opportunity evidence",
        })),
      );
    }
  }

  return {
    snapshotId,
    scenarioRows,
    assumptionRows,
    evaluationRows,
    contributionRows,
    metricRows,
    evidenceRows,
    validationRows: result.validations.map((item) => ({
      organizationId,
      snapshotId,
      ...item,
    })),
    catalogVersionsJson: result.catalogVersions as unknown as Prisma.InputJsonValue,
    provenanceJson: {
      automationOpportunitySnapshotId: input.automationSnapshotId,
      aiOpportunitySnapshotId: input.aiSnapshotId,
      businessAnalysisId: input.analysisId,
      processMapId: input.processMapId,
      knowledgeSnapshotId: input.knowledgeSnapshotId,
      assumptionInputs: input.assumptions.map((definition) =>
        input.unknownAssumptions.includes(definition.code)
          ? { code: definition.code, status: "unknown" }
          : {
              code: definition.code,
              status: "known",
              value: input.suppliedAssumptions[definition.code] ?? definition.defaultValue,
            },
      ),
    } as Prisma.InputJsonValue,
  };
}

export class PrismaRoiEvaluationRepository {
  constructor(private readonly db: TransactionClient) {}
  context(userId: string) {
    return this.db.organizationMember.findFirst({
      where: { userId },
      select: { organizationId: true, role: true },
    });
  }
  snapshot(organizationId: string, id: string) {
    return this.db.roiEvaluationSnapshot.findFirst({ where: { organizationId, id } });
  }
  automationSnapshot(organizationId: string, id: string) {
    return this.db.automationOpportunitySnapshot.findFirst({
      where: { organizationId, id, status: "published" },
    });
  }
  async input(
    organizationId: string,
    automationSnapshotId: string,
    currency: string,
    suppliedAssumptions: Partial<Record<AssumptionCode, number>>,
    unknownAssumptions: AssumptionCode[],
  ): Promise<RoiInput | null> {
    const automation = await this.automationSnapshot(organizationId, automationSnapshotId);
    if (!automation) return null;
    const [
      ai,
      analysis,
      processMap,
      knowledge,
      opportunities,
      evidence,
      aiLinks,
      models,
      assumptions,
    ] = await Promise.all([
      this.db.aiOpportunitySnapshot.findFirst({
        where: { organizationId, id: automation.aiOpportunitySnapshotId, status: "published" },
      }),
      this.db.analysisSnapshot.findFirst({
        where: { organizationId, id: automation.businessAnalysisId, status: "published" },
      }),
      this.db.processMap.findFirst({
        where: { organizationId, id: automation.processMapId, status: "published" },
      }),
      this.db.knowledgeSnapshot.findFirst({
        where: { organizationId, id: automation.knowledgeSnapshotId, status: "ready" },
      }),
      this.db.automationOpportunity.findMany({
        where: { organizationId, snapshotId: automationSnapshotId },
      }),
      this.db.automationOpportunityEvidence.findMany({
        where: { organizationId, snapshotId: automationSnapshotId },
      }),
      this.db.automationOpportunityAiLink.findMany({
        where: { organizationId, snapshotId: automationSnapshotId },
      }),
      this.db.roiModelCatalog.findMany({
        where: { published: true, OR: [{ organizationId: null }, { organizationId }] },
        orderBy: [{ code: "asc" }, { version: "desc" }],
      }),
      this.db.roiAssumptionCatalog.findMany({
        where: { published: true, OR: [{ organizationId: null }, { organizationId }] },
        orderBy: [{ code: "asc" }, { version: "desc" }],
      }),
    ]);
    if (!ai || !analysis || !processMap || !knowledge) return null;
    return {
      automationSnapshotId,
      automationStatus: automation.status,
      aiSnapshotId: ai.id,
      aiStatus: ai.status,
      analysisId: analysis.id,
      analysisStatus: analysis.status,
      processMapId: processMap.id,
      processMapStatus: processMap.status,
      knowledgeSnapshotId: knowledge.id,
      currency,
      suppliedAssumptions,
      unknownAssumptions,
      opportunities: opportunities.map((item) => ({
        id: item.id,
        identifier: item.identifier,
        title: item.title,
        description: item.description,
        automationCoverage: Number(item.automationCoverage),
        confidence: Number(item.confidence),
        evidence: evidence
          .filter((value) => value.opportunityId === item.id)
          .map((value) => ({
            id: value.id,
            businessFindingId: value.businessFindingId,
            knowledgeFactId: value.knowledgeFactId,
          })),
        aiOpportunityIds: aiLinks
          .filter((value) => value.opportunityId === item.id)
          .map((value) => value.aiOpportunityId),
      })),
      models: latest(models).map((item): RoiModelDefinition => ({
        id: item.id,
        code: item.code,
        version: item.version,
        formula: item.formulaJson as Record<string, unknown>,
        requiredInputs: item.requiredInputs as string[],
        outputs: item.outputs as string[],
      })),
      assumptions: latest(assumptions).map((item): RoiAssumptionDefinition => ({
        id: item.id,
        code: item.code as AssumptionCode,
        version: item.version,
        unit: item.unit,
        defaultValue: item.defaultValue === null ? null : Number(item.defaultValue),
        required: item.required,
      })),
    };
  }
  async frozenAssumptions(organizationId: string, snapshotId: string) {
    const snapshot = await this.snapshot(organizationId, snapshotId);
    const frozen = readFrozenAssumptions(snapshot?.provenanceJson);
    if (frozen) return frozen;
    const scenario = await this.db.roiScenario.findFirst({
      where: { organizationId, snapshotId, type: "expected" },
    });
    if (!scenario) return { suppliedAssumptions: {}, unknownAssumptions: [] };
    const rows = await this.db.roiScenarioAssumption.findMany({
      where: { organizationId, snapshotId, scenarioId: scenario.id },
    });
    const catalog = await this.db.roiAssumptionCatalog.findMany({
      where: { id: { in: rows.map((item) => item.assumptionId) } },
    });
    const codes = new Map(catalog.map((item) => [item.id, item.code as AssumptionCode]));
    return {
      suppliedAssumptions: Object.fromEntries(
        rows
          .map((item) => [codes.get(item.assumptionId)!, Number(item.value)])
          .filter(([code]) => code),
      ) as Partial<Record<AssumptionCode, number>>,
      unknownAssumptions: [],
    };
  }
  async detail(organizationId: string, id: string) {
    const snapshot = await this.snapshot(organizationId, id);
    if (!snapshot) return null;
    const [scenarios, evaluations, assumptions, contributions, metrics, evidence, validations] =
      await Promise.all([
        this.db.roiScenario.findMany({
          where: { organizationId, snapshotId: id },
          orderBy: { type: "asc" },
        }),
        this.db.roiEvaluation.findMany({ where: { organizationId, snapshotId: id } }),
        this.db.roiScenarioAssumption.findMany({ where: { organizationId, snapshotId: id } }),
        this.db.roiContribution.findMany({ where: { organizationId, snapshotId: id } }),
        this.db.roiMetric.findMany({ where: { organizationId, snapshotId: id } }),
        this.db.roiEvidence.findMany({ where: { organizationId, snapshotId: id } }),
        this.db.roiValidation.findMany({ where: { organizationId, snapshotId: id } }),
      ]);
    return {
      snapshot,
      scenarios,
      evaluations,
      assumptions,
      contributions,
      metrics,
      evidence,
      validations,
    };
  }
  detailScenarios(organizationId: string, id: string) {
    return this.db.roiScenario.findMany({
      where: { organizationId, snapshotId: id },
      orderBy: { type: "asc" },
    });
  }
  detailEvaluations(organizationId: string, id: string) {
    return this.db.roiEvaluation.findMany({ where: { organizationId, snapshotId: id } });
  }
  detailAssumptions(organizationId: string, id: string) {
    return this.db.roiScenarioAssumption.findMany({ where: { organizationId, snapshotId: id } });
  }
  detailContributions(organizationId: string, id: string) {
    return this.db.roiContribution.findMany({ where: { organizationId, snapshotId: id } });
  }
  detailMetrics(organizationId: string, id: string) {
    return this.db.roiMetric.findMany({ where: { organizationId, snapshotId: id } });
  }
  detailEvidence(organizationId: string, id: string) {
    return this.db.roiEvidence.findMany({ where: { organizationId, snapshotId: id } });
  }
  detailValidations(organizationId: string, id: string) {
    return this.db.roiValidation.findMany({ where: { organizationId, snapshotId: id } });
  }
  async transitionReadiness(organizationId: string, id: string) {
    const snapshot = await this.snapshot(organizationId, id);
    if (!snapshot) return null;
    const [validationErrorCount, scenarioCount, evaluations, metricCounts, evidenceCounts] =
      await Promise.all([
        this.db.roiValidation.count({
          where: { organizationId, snapshotId: id, severity: "error" },
        }),
        this.db.roiScenario.count({ where: { organizationId, snapshotId: id } }),
        this.db.roiEvaluation.findMany({
          where: { organizationId, snapshotId: id },
          select: { id: true },
        }),
        this.db.roiMetric.groupBy({
          by: ["evaluationId"],
          where: { organizationId, snapshotId: id },
          _count: { _all: true },
        }),
        this.db.roiEvidence.groupBy({
          by: ["evaluationId"],
          where: { organizationId, snapshotId: id },
          _count: { _all: true },
        }),
      ]);
    const metricsByEvaluation = new Map(
      metricCounts.map((item) => [item.evaluationId, item._count._all]),
    );
    const evidenceByEvaluation = new Map(
      evidenceCounts.map((item) => [item.evaluationId, item._count._all]),
    );
    return {
      snapshot,
      validationErrorCount,
      scenarioCount,
      evaluationCount: evaluations.length,
      evaluationsTraceable: evaluations.every(
        (item) =>
          (metricsByEvaluation.get(item.id) ?? 0) === 13 &&
          (evidenceByEvaluation.get(item.id) ?? 0) > 0,
      ),
    };
  }
  async list(
    organizationId: string,
    companyId: string,
    query: { page: number; pageSize: number; status?: string; scenario?: string },
  ) {
    const where = {
      organizationId,
      companyId,
      ...(query.status ? { status: query.status as "draft" } : {}),
    };
    const [items, total] = await Promise.all([
      this.db.roiEvaluationSnapshot.findMany({
        where,
        orderBy: { versionNumber: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.roiEvaluationSnapshot.count({ where }),
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
    input: RoiInput,
    result: Result,
    previousVersionId: string | null,
    expectedPreviousLockVersion?: number,
    expectedPreviousStatus?: "draft",
  ) {
    const plan = prepareRoiPersistencePlan(organizationId, input, result);
    return this.persistPrepared(
      organizationId,
      companyId,
      userId,
      input,
      plan,
      previousVersionId,
      expectedPreviousLockVersion,
      expectedPreviousStatus,
    );
  }

  async persistPrepared(
    organizationId: string,
    companyId: string,
    userId: string,
    input: RoiInput,
    plan: PreparedRoiPersistencePlan,
    previousVersionId: string | null,
    expectedPreviousLockVersion?: number,
    expectedPreviousStatus?: "draft",
  ) {
    await this.db
      .$executeRaw`select pg_advisory_xact_lock(hashtextextended(${`${organizationId}:${input.automationSnapshotId}:roi`},0))`;
    const latestSnapshot = await this.db.roiEvaluationSnapshot.findFirst({
      where: { organizationId, automationOpportunitySnapshotId: input.automationSnapshotId },
      orderBy: { versionNumber: "desc" },
    });
    if (
      previousVersionId &&
      (latestSnapshot?.id !== previousVersionId ||
        latestSnapshot.lockVersion !== expectedPreviousLockVersion ||
        (expectedPreviousStatus && latestSnapshot.status !== expectedPreviousStatus))
    )
      throw new RoiConflictError();
    const snapshot = await this.db.roiEvaluationSnapshot.create({
      data: {
        id: plan.snapshotId,
        organizationId,
        companyId,
        automationOpportunitySnapshotId: input.automationSnapshotId,
        aiOpportunitySnapshotId: input.aiSnapshotId,
        businessAnalysisId: input.analysisId,
        processMapId: input.processMapId,
        knowledgeSnapshotId: input.knowledgeSnapshotId,
        previousVersionId,
        versionNumber: (latestSnapshot?.versionNumber ?? 0) + 1,
        currency: input.currency,
        catalogVersionsJson: plan.catalogVersionsJson,
        provenanceJson: plan.provenanceJson,
        createdBy: userId,
      },
    });
    if (plan.scenarioRows.length) await this.db.roiScenario.createMany({ data: plan.scenarioRows });
    if (plan.assumptionRows.length)
      await this.db.roiScenarioAssumption.createMany({ data: plan.assumptionRows });
    if (plan.evaluationRows.length)
      await this.db.roiEvaluation.createMany({ data: plan.evaluationRows });
    if (plan.contributionRows.length)
      await this.db.roiContribution.createMany({ data: plan.contributionRows });
    if (plan.metricRows.length) await this.db.roiMetric.createMany({ data: plan.metricRows });
    if (plan.evidenceRows.length) await this.db.roiEvidence.createMany({ data: plan.evidenceRows });
    if (plan.validationRows.length)
      await this.db.roiValidation.createMany({ data: plan.validationRows });
    return snapshot;
  }
  async transition(
    organizationId: string,
    id: string,
    lockVersion: number,
    status: "validated" | "published",
  ) {
    const changed = await this.db.roiEvaluationSnapshot.updateMany({
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
    if (changed.count !== 1) throw new RoiConflictError();
    return this.snapshot(organizationId, id);
  }
}

export function readFrozenAssumptions(value: Prisma.JsonValue | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const inputs = value.assumptionInputs;
  if (!Array.isArray(inputs)) return null;
  const suppliedAssumptions: Partial<Record<AssumptionCode, number>> = {};
  const unknownAssumptions: AssumptionCode[] = [];
  for (const item of inputs) {
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.code !== "string")
      return null;
    if (!ASSUMPTION_CODES.has(item.code)) return null;
    const code = item.code as AssumptionCode;
    if (item.status === "unknown") unknownAssumptions.push(code);
    else if (item.status === "known" && typeof item.value === "number")
      suppliedAssumptions[code] = item.value;
    else return null;
  }
  return { suppliedAssumptions, unknownAssumptions };
}

const ASSUMPTION_CODES = new Set<string>([
  "hourly_cost",
  "working_days",
  "working_hours",
  "monthly_frequency",
  "annual_frequency",
  "hours_saved_per_occurrence",
  "implementation_cost",
  "maintenance_cost",
  "training_cost",
  "infrastructure_cost",
  "error_cost",
]);
