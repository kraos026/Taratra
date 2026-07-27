import { Prisma } from "@/generated/prisma/client";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import type {
  BlueprintResult,
  CapabilityDefinition,
  ConnectorDefinition,
  ConstraintDefinition,
  DesignerInput,
  PatternDefinition,
  PatternTemplate,
  ValidationRuleDefinition,
} from "../domain/solution-designer";
import { SolutionBlueprintConflictError } from "../application/solution-blueprint-errors";
import type { SolutionBlueprintRepository } from "../application/solution-blueprint-repository";

const latest = <T extends { code: string }>(rows: T[]) => {
  const values = new Map<string, T>();
  for (const row of rows) if (!values.has(row.code)) values.set(row.code, row);
  return [...values.values()];
};
const strings = (value: Prisma.JsonValue) => value as string[];

export class PrismaSolutionBlueprintRepository implements SolutionBlueprintRepository {
  constructor(private readonly db: TransactionClient) {}
  context(userId: string) {
    return this.db.organizationMember.findFirst({
      where: { userId },
      select: { organizationId: true, role: true },
    });
  }
  snapshot(organizationId: string, id: string) {
    return this.db.solutionBlueprint.findFirst({ where: { organizationId, id } });
  }
  async prepareRebuild(organizationId: string, id: string, lockVersion: number) {
    const current = await this.snapshot(organizationId, id);
    if (!current) return null;
    await this.db
      .$executeRaw`select pg_advisory_xact_lock(hashtextextended(${`${organizationId}:${current.recommendationId}:blueprint`},0))`;
    const [lockedCurrent] = await this.db.$queryRaw<
      {
        id: string;
        recommendationId: string;
        status: "draft" | "validated" | "published" | "archived";
        lockVersion: number;
      }[]
    >`select id, recommendation_id as "recommendationId", status::text as status, lock_version as "lockVersion"
      from public.solution_blueprints
      where organization_id=${organizationId}::uuid and id=${id}::uuid
      for update`;
    if (!lockedCurrent) return null;
    const latestBlueprint = await this.db.solutionBlueprint.findFirst({
      where: { organizationId, recommendationId: lockedCurrent.recommendationId },
      orderBy: { versionNumber: "desc" },
    });
    if (
      lockedCurrent.lockVersion !== lockVersion ||
      !latestBlueprint ||
      latestBlueprint.id !== lockedCurrent.id
    )
      throw new SolutionBlueprintConflictError();
    return lockedCurrent;
  }
  async input(organizationId: string, recommendationId: string): Promise<DesignerInput | null> {
    const recommendation = await this.db.transformationRecommendation.findFirst({
      where: { organizationId, id: recommendationId },
    });
    if (!recommendation) return null;
    const [snapshot, evidence, patterns, capabilities, connectors, constraints, validationRules] =
      await Promise.all([
        this.db.recommendationPortfolioSnapshot.findFirst({
          where: { organizationId, id: recommendation.snapshotId, status: "published" },
        }),
        this.db.transformationRecommendationEvidence.findMany({
          where: { organizationId, recommendationId },
        }),
        this.db.solutionPatternCatalog.findMany({
          where: { published: true, OR: [{ organizationId: null }, { organizationId }] },
          orderBy: [{ code: "asc" }, { version: "desc" }],
        }),
        this.db.solutionCapabilityCatalog.findMany({
          where: { published: true, OR: [{ organizationId: null }, { organizationId }] },
          orderBy: [{ code: "asc" }, { version: "desc" }],
        }),
        this.db.solutionConnectorRequirementCatalog.findMany({
          where: { published: true, OR: [{ organizationId: null }, { organizationId }] },
          orderBy: [{ code: "asc" }, { version: "desc" }],
        }),
        this.db.solutionConstraintCatalog.findMany({
          where: { published: true, OR: [{ organizationId: null }, { organizationId }] },
          orderBy: [{ code: "asc" }, { version: "desc" }],
        }),
        this.db.solutionValidationRuleCatalog.findMany({
          where: { published: true, OR: [{ organizationId: null }, { organizationId }] },
          orderBy: [{ code: "asc" }, { version: "desc" }],
        }),
      ]);
    if (!snapshot) return null;
    const [roi, automation] = await Promise.all([
      this.db.roiEvaluationSnapshot.findFirst({
        where: { organizationId, id: recommendation.roiSnapshotId, status: "published" },
      }),
      this.db.automationOpportunitySnapshot.findFirst({
        where: {
          organizationId,
          id: recommendation.automationOpportunitySnapshotId,
          status: "published",
        },
      }),
    ]);
    if (!roi || !automation) return null;
    return {
      source: {
        recommendationId: recommendation.id,
        recommendationIdentifier: recommendation.identifier,
        recommendationTitle: recommendation.title,
        recommendationDescription: recommendation.description,
        recommendationCategory: recommendation.category,
        recommendationStatus: snapshot.status,
        recommendationSnapshotId: snapshot.id,
        roiSnapshotId: roi.id,
        roiStatus: roi.status,
        automationOpportunityId: recommendation.automationOpportunityId,
        automationSnapshotId: automation.id,
        automationStatus: automation.status,
        companyId: snapshot.companyId,
        evidenceIds: evidence.map((item) => item.id),
      },
      patterns: latest(patterns).map((item): PatternDefinition => ({
        id: item.id,
        code: item.code,
        name: item.name,
        version: item.version,
        recommendationCategories: strings(item.recommendationCategories),
        template: item.templateJson as unknown as PatternTemplate,
        published: item.published,
      })),
      capabilities: latest(capabilities).map((item): CapabilityDefinition => ({
        id: item.id,
        code: item.code,
        name: item.name,
        version: item.version,
        costIndex: Number(item.costIndex),
        published: item.published,
      })),
      connectors: latest(connectors).map((item): ConnectorDefinition => ({
        id: item.id,
        code: item.code,
        name: item.name,
        version: item.version,
        costIndex: Number(item.costIndex),
        capabilities: strings(item.capabilities),
        secrets: strings(item.secrets),
        permissions: strings(item.permissions),
        inputs: strings(item.inputs),
        outputs: strings(item.outputs),
        published: item.published,
      })),
      constraints: latest(constraints).map((item): ConstraintDefinition => ({
        id: item.id,
        code: item.code,
        name: item.name,
        version: item.version,
        published: item.published,
      })),
      validationRules: latest(validationRules).map((item): ValidationRuleDefinition => ({
        id: item.id,
        code: item.code,
        version: item.version,
        description: item.description,
        severity: item.severity,
        configuration: item.ruleJson as unknown as ValidationRuleDefinition["configuration"],
        published: item.published,
      })),
    };
  }
  async persist(
    organizationId: string,
    userId: string,
    input: DesignerInput,
    result: BlueprintResult,
    previousVersionId: string | null,
  ) {
    if (!result.pattern) throw new Error("Pattern unavailable");
    await this.db.$executeRaw`select set_config('app.solution_designer_internal_write','on',true)`;
    await this.db
      .$executeRaw`select pg_advisory_xact_lock(hashtextextended(${`${organizationId}:${input.source.recommendationId}:blueprint`},0))`;
    const latestBlueprint = await this.db.solutionBlueprint.findFirst({
      where: { organizationId, recommendationId: input.source.recommendationId },
      orderBy: { versionNumber: "desc" },
    });
    const blueprint = await this.db.solutionBlueprint.create({
      data: {
        organizationId,
        companyId: input.source.companyId,
        recommendationId: input.source.recommendationId,
        recommendationSnapshotId: input.source.recommendationSnapshotId,
        roiSnapshotId: input.source.roiSnapshotId,
        automationOpportunityId: input.source.automationOpportunityId,
        automationOpportunitySnapshotId: input.source.automationSnapshotId,
        patternId: result.pattern.id,
        previousVersionId: previousVersionId ?? latestBlueprint?.id ?? null,
        versionNumber: (latestBlueprint?.versionNumber ?? 0) + 1,
        name: result.name,
        description: result.description,
        objective: result.objective,
        architecture: result.architecture,
        componentsJson: result.components as unknown as Prisma.InputJsonValue,
        capabilitiesJson: result.capabilities as unknown as Prisma.InputJsonValue,
        connectorsJson: result.connectors as unknown as Prisma.InputJsonValue,
        constraintsJson: result.constraints as unknown as Prisma.InputJsonValue,
        assumptionsJson: [] as Prisma.InputJsonValue,
        secretsJson: result.secrets,
        permissionsJson: result.permissions,
        inputsJson: result.inputs,
        outputsJson: result.outputs,
        topologyJson: result.topology as unknown as Prisma.InputJsonValue,
        dependenciesJson: result.topology as unknown as Prisma.InputJsonValue,
        risksJson: result.risks as unknown as Prisma.InputJsonValue,
        finalRisk: result.finalRisk,
        estimatedTechnicalCostIndex: result.estimatedTechnicalCostIndex,
        complexityScore: result.complexityScore,
        catalogVersionsJson: result.catalogVersions as unknown as Prisma.InputJsonValue,
        provenanceJson: input.source as unknown as Prisma.InputJsonValue,
        createdBy: userId,
      },
    });
    if (result.evidenceIds.length)
      await this.db.solutionBlueprintEvidence.createMany({
        data: result.evidenceIds.map((recommendationEvidenceId) => ({
          organizationId,
          blueprintId: blueprint.id,
          recommendationEvidenceId,
          explanation: "Published Recommendation evidence",
        })),
      });
    await this.db.solutionBlueprintValidation.createMany({
      data: result.validations.map((validation) => ({
        organizationId,
        blueprintId: blueprint.id,
        ...validation,
      })),
    });
    return blueprint;
  }
  async detail(organizationId: string, id: string) {
    const blueprint = await this.snapshot(organizationId, id);
    if (!blueprint) return null;
    const [evidence, validations] = await Promise.all([
      this.db.solutionBlueprintEvidence.findMany({ where: { organizationId, blueprintId: id } }),
      this.db.solutionBlueprintValidation.findMany({ where: { organizationId, blueprintId: id } }),
    ]);
    return { blueprint, evidence, validations };
  }
  async list(
    organizationId: string,
    companyId: string,
    query: { page: number; pageSize: number; status?: string },
  ) {
    const where = {
      organizationId,
      companyId,
      ...(query.status ? { status: query.status as "draft" } : {}),
    };
    const [items, total] = await Promise.all([
      this.db.solutionBlueprint.findMany({
        where,
        orderBy: { versionNumber: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.solutionBlueprint.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }
  async transition(
    organizationId: string,
    id: string,
    lockVersion: number,
    status: "validated" | "published",
  ) {
    const changed = await this.db.solutionBlueprint.updateMany({
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
    if (changed.count !== 1) throw new SolutionBlueprintConflictError();
    return this.snapshot(organizationId, id);
  }
}
