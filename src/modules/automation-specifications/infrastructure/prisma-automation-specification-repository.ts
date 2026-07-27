import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import type {
  AutomationSpecificationInput,
  AutomationSpecificationResult,
  PublishedBlueprint,
  SpecificationRule,
  SpecificationStatus,
} from "../domain/automation-specification";
import type {
  AutomationSpecificationDetail,
  AutomationSpecificationRepository,
  AutomationSpecificationSnapshot,
} from "../application/automation-specification-repository";
import { AutomationSpecificationConflictError } from "../application/automation-specification-errors";

export class PrismaAutomationSpecificationRepository implements AutomationSpecificationRepository {
  constructor(private readonly db: TransactionClient) {}

  context(userId: string) {
    return this.db.organizationMember.findFirst({
      where: { userId },
      select: { organizationId: true, role: true },
    });
  }

  async input(
    organizationId: string,
    solutionBlueprintId: string,
  ): Promise<AutomationSpecificationInput | null> {
    const blueprint = await this.db.solutionBlueprint.findFirst({
      where: { id: solutionBlueprintId, organizationId, status: "published" },
    });
    if (!blueprint) return null;
    const rows = await this.db.automationSpecificationRuleCatalog.findMany({
      where: {
        status: "published",
        OR: [{ organizationId: null }, { organizationId }],
      },
      orderBy: [{ version: "desc" }],
    });
    const selected = new Map<string, (typeof rows)[number]>();
    for (const row of [...rows].sort((left, right) => {
      const tenantOrder =
        Number(Boolean(right.organizationId)) - Number(Boolean(left.organizationId));
      return tenantOrder || right.version - left.version;
    }))
      if (!selected.has(row.code)) selected.set(row.code, row);
    return {
      blueprint: this.blueprint(blueprint),
      rules: [...selected.values()].map((row) => this.rule(row)),
    };
  }

  async persist(
    organizationId: string,
    userId: string,
    input: AutomationSpecificationInput,
    result: AutomationSpecificationResult,
    previousVersionId: string | null,
  ) {
    await this.db
      .$executeRaw`select set_config('app.automation_specification_internal_write','on',true)`;
    await this.db
      .$executeRaw`select pg_advisory_xact_lock(hashtextextended(${`${organizationId}:${input.blueprint.id}:automation-specification`},0))`;
    const latest = await this.db.automationSpecification.findFirst({
      where: { organizationId, solutionBlueprintId: input.blueprint.id },
      orderBy: { versionNumber: "desc" },
    });
    if (
      (previousVersionId === null && latest) ||
      (previousVersionId !== null && (!latest || latest.id !== previousVersionId))
    )
      throw new AutomationSpecificationConflictError();
    const specification = await this.db.automationSpecification.create({
      data: {
        organizationId,
        solutionBlueprintId: input.blueprint.id,
        solutionBlueprintVersionNumber: input.blueprint.versionNumber,
        previousVersionId,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        name: result.name,
        objective: result.objective,
        scope: result.scope,
        sourceFingerprint: fingerprint(input.blueprint),
        catalogVersionsJson: json(result.catalogVersions),
        createdBy: userId,
      },
    });
    if (result.elements.length)
      await this.db.automationSpecificationElement.createMany({
        data: result.elements.map((element) => ({
          organizationId,
          automationSpecificationId: specification.id,
          localId: element.localId,
          elementType: element.type,
          definitionJson: json(element.definition),
          displayOrder: element.displayOrder,
        })),
      });
    if (result.provenance.length)
      await this.db.automationSpecificationProvenance.createMany({
        data: result.provenance.map((item) => ({
          organizationId,
          automationSpecificationId: specification.id,
          targetLocalId: item.targetLocalId,
          sourceElementType: item.sourceElementType,
          sourceElementId: item.sourceElementId,
          catalogRuleCode: item.ruleCode,
          catalogRuleVersion: item.ruleVersion,
          reason: item.reason,
          consumed: item.consumed,
        })),
      });
    if (result.validations.length)
      await this.db.automationSpecificationValidation.createMany({
        data: result.validations.map((validation) => ({
          organizationId,
          automationSpecificationId: specification.id,
          ruleCode: validation.ruleCode,
          ruleVersion: validation.ruleVersion,
          severity: validation.severity,
          passed: validation.passed,
          targetLocalId: validation.targetLocalId,
          message: validation.message,
          detailsJson: json(validation.details),
        })),
      });
    return this.detail(organizationId, specification.id);
  }

  async prepareRebuild(
    organizationId: string,
    id: string,
    lockVersion: number,
  ): Promise<AutomationSpecificationSnapshot | null> {
    const current = await this.db.automationSpecification.findFirst({
      where: { organizationId, id },
    });
    if (!current) return null;
    await this.db
      .$executeRaw`select pg_advisory_xact_lock(hashtextextended(${`${organizationId}:${current.solutionBlueprintId}:automation-specification`},0))`;
    const [locked] = await this.db.$queryRaw<
      {
        id: string;
        organizationId: string;
        solutionBlueprintId: string;
        status: SpecificationStatus;
        lockVersion: number;
        versionNumber: number;
      }[]
    >`select id,organization_id as "organizationId",solution_blueprint_id as "solutionBlueprintId",
       status::text as status,lock_version as "lockVersion",version_number as "versionNumber"
       from public.automation_specifications
       where organization_id=${organizationId}::uuid and id=${id}::uuid for update`;
    if (!locked) return null;
    const latest = await this.db.automationSpecification.findFirst({
      where: { organizationId, solutionBlueprintId: locked.solutionBlueprintId },
      orderBy: { versionNumber: "desc" },
    });
    if (locked.lockVersion !== lockVersion || latest?.id !== locked.id)
      throw new AutomationSpecificationConflictError();
    return { ...locked, isLatestVersion: true };
  }

  async detail(organizationId: string, id: string): Promise<AutomationSpecificationDetail | null> {
    const specification = await this.db.automationSpecification.findFirst({
      where: { organizationId, id },
      include: {
        elements: { orderBy: { displayOrder: "asc" } },
        provenance: { orderBy: { createdAt: "asc" } },
        validations: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!specification) return null;
    const latest = await this.db.automationSpecification.findFirst({
      where: { organizationId, solutionBlueprintId: specification.solutionBlueprintId },
      orderBy: { versionNumber: "desc" },
      select: { id: true },
    });
    return {
      specification: {
        ...specification,
        status: specification.status,
        isLatestVersion: latest?.id === specification.id,
      },
      validations: specification.validations.map((validation) => ({
        ruleCode: validation.ruleCode,
        ruleVersion: validation.ruleVersion,
        severity: validation.severity,
        passed: validation.passed,
        targetLocalId: validation.targetLocalId,
        message: validation.message,
        details: validation.detailsJson as Record<string, unknown>,
      })),
    };
  }

  async list(
    organizationId: string,
    solutionBlueprintId: string,
    query: {
      page: number;
      pageSize: number;
      status?: SpecificationStatus;
      latestPublished?: boolean;
    },
  ) {
    const where = {
      organizationId,
      solutionBlueprintId,
      ...(query.latestPublished ? { status: "published" as const } : {}),
      ...(!query.latestPublished && query.status ? { status: query.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.db.automationSpecification.findMany({
        where,
        orderBy: { versionNumber: "desc" },
        skip: query.latestPublished ? 0 : (query.page - 1) * query.pageSize,
        take: query.latestPublished ? 1 : query.pageSize,
      }),
      this.db.automationSpecification.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async transition(
    organizationId: string,
    id: string,
    lockVersion: number,
    status: "validated" | "published" | "archived",
  ) {
    const result = await this.db.automationSpecification.updateMany({
      where: { organizationId, id, lockVersion },
      data: {
        status,
        lockVersion: { increment: 1 },
        ...(status === "validated" ? { validatedAt: new Date() } : {}),
        ...(status === "published" ? { publishedAt: new Date() } : {}),
        ...(status === "archived" ? { archivedAt: new Date() } : {}),
      },
    });
    if (result.count !== 1) throw new AutomationSpecificationConflictError();
    return this.detail(organizationId, id);
  }

  private blueprint(row: {
    id: string;
    organizationId: string;
    versionNumber: number;
    status: "draft" | "validated" | "published" | "archived";
    name: string;
    objective: string;
    componentsJson: Prisma.JsonValue;
    capabilitiesJson: Prisma.JsonValue;
    connectorsJson: Prisma.JsonValue;
    constraintsJson: Prisma.JsonValue;
    inputsJson: Prisma.JsonValue;
    outputsJson: Prisma.JsonValue;
    topologyJson: Prisma.JsonValue;
  }): PublishedBlueprint {
    return {
      id: row.id,
      organizationId: row.organizationId,
      versionNumber: row.versionNumber,
      status: row.status,
      name: row.name,
      objective: row.objective,
      components: row.componentsJson as unknown as PublishedBlueprint["components"],
      capabilities: row.capabilitiesJson as unknown as PublishedBlueprint["capabilities"],
      connectors: row.connectorsJson as unknown as PublishedBlueprint["connectors"],
      constraints: row.constraintsJson as unknown as PublishedBlueprint["constraints"],
      inputs: row.inputsJson as unknown as string[],
      outputs: row.outputsJson as unknown as string[],
      topology: row.topologyJson as unknown as PublishedBlueprint["topology"],
    };
  }

  private rule(row: {
    id: string;
    code: string;
    version: number;
    ruleType: "transformation" | "validation";
    resultJson: Prisma.JsonValue;
    severity: "error" | "warning" | "information" | null;
    description: string;
    status: string;
  }): SpecificationRule {
    const result = row.resultJson as Record<string, unknown>;
    return {
      id: row.id,
      code: row.code,
      version: row.version,
      ruleType: row.ruleType,
      decision:
        row.ruleType === "transformation"
          ? (result.decision as SpecificationRule["decision"])
          : undefined,
      operator:
        row.ruleType === "validation"
          ? (result.operator as SpecificationRule["operator"])
          : undefined,
      severity: row.severity ?? undefined,
      description: row.description,
      published: row.status === "published",
    };
  }
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function fingerprint(blueprint: PublishedBlueprint) {
  return createHash("sha256").update(JSON.stringify(blueprint)).digest("hex");
}
