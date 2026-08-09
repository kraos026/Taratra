import { Prisma } from "@/generated/prisma/client";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import type { WorkActivityRepository } from "../application/work-activity-repository";
import { WorkActivity, WorkIntelligenceError } from "../domain/work-intelligence";

type WorkActivityRow = Awaited<ReturnType<PrismaWorkActivityRepository["findRow"]>>;

export class PrismaWorkActivityRepository implements WorkActivityRepository {
  constructor(private readonly db: TransactionClient) {}

  async append(activity: WorkActivity, expectedVersion: number): Promise<void> {
    const latest = await this.latest(activity.tenantId, activity.companyId, activity.lineageId);
    if ((latest?.version ?? 0) !== expectedVersion)
      throw new WorkIntelligenceError("Work activity version conflict");
    await this.db.workActivity.create({ data: this.toCreateInput(activity) });
  }

  async appendBatch(activities: readonly WorkActivity[]): Promise<void> {
    for (const activity of activities) {
      const latest = await this.latest(activity.tenantId, activity.companyId, activity.lineageId);
      if (latest)
        throw new WorkIntelligenceError("Atomic activity batch contains a version conflict");
    }
    await this.db.workActivity.createMany({
      data: activities.map((activity) => this.toCreateInput(activity)),
    });
  }

  async get(tenantId: string, companyId: string, activityId: string): Promise<WorkActivity | null> {
    const row = await this.findRow({
      organizationId: tenantId,
      companyId,
      id: activityId,
    });
    return row ? this.toDomain(row) : null;
  }

  async latest(
    tenantId: string,
    companyId: string,
    lineageId: string,
  ): Promise<WorkActivity | null> {
    const row = await this.db.workActivity.findFirst({
      where: { organizationId: tenantId, companyId, lineageId },
      orderBy: { version: "desc" },
    });
    return row ? this.toDomain(row) : null;
  }

  async list(tenantId: string, companyId: string): Promise<readonly WorkActivity[]> {
    const rows = await this.db.workActivity.findMany({
      where: { organizationId: tenantId, companyId },
      orderBy: [{ lineageId: "asc" }, { version: "desc" }],
    });
    const latest = new Map<string, WorkActivity>();
    for (const row of rows)
      if (!latest.has(row.lineageId)) latest.set(row.lineageId, this.toDomain(row));
    return Object.freeze(
      [...latest.values()].sort(
        (left, right) => left.startedAt.getTime() - right.startedAt.getTime(),
      ),
    );
  }

  async history(
    tenantId: string,
    companyId: string,
    lineageId: string,
  ): Promise<readonly WorkActivity[]> {
    const rows = await this.db.workActivity.findMany({
      where: { organizationId: tenantId, companyId, lineageId },
      orderBy: { version: "asc" },
    });
    return Object.freeze(rows.map((row) => this.toDomain(row)));
  }

  private findRow(where: { organizationId: string; companyId: string; id: string }) {
    return this.db.workActivity.findFirst({ where });
  }

  private toCreateInput(activity: WorkActivity) {
    if (!activity.retentionPolicy)
      throw new WorkIntelligenceError("Retention policy reference is required for persistence");
    return {
      id: activity.activityId,
      organizationId: activity.tenantId,
      companyId: activity.companyId,
      lineageId: activity.lineageId,
      version: activity.version,
      supersedesActivityId: activity.supersedesActivityId,
      confirmationState: activity.confirmationState,
      evidenceKind: activity.evidenceKind,
      source: activity.source,
      actorRole: activity.actorRole,
      departmentId: activity.departmentId,
      activityType: activity.activityType,
      originalDescription: activity.originalDescription,
      normalizedActivity: activity.normalizedActivity,
      category: activity.category,
      toolsJson: activity.tools as Prisma.InputJsonValue,
      startedAt: activity.startedAt,
      endedAt: activity.endedAt,
      durationMinutes: new Prisma.Decimal(activity.durationMinutes),
      confidence: new Prisma.Decimal(activity.confidence),
      recurrenceHintsJson: activity.recurrenceHints as Prisma.InputJsonValue,
      humanJudgment: new Prisma.Decimal(activity.humanJudgment),
      operationalRisk: new Prisma.Decimal(activity.operationalRisk),
      metadataJson: activity.metadata as Prisma.InputJsonValue,
      provenanceJson: activity.provenance as Prisma.InputJsonValue,
      retentionPolicyId: activity.retentionPolicy.policyId,
      retentionPolicyVersion: activity.retentionPolicy.version,
      capturedBy: activity.capturedBy,
      confirmedBy: activity.confirmedBy,
      confirmedAt: activity.confirmedAt,
    };
  }

  private toDomain(row: NonNullable<WorkActivityRow>): WorkActivity {
    return WorkActivity.create({
      activityId: row.id,
      lineageId: row.lineageId,
      version: row.version,
      tenantId: row.organizationId,
      companyId: row.companyId,
      actorRole: row.actorRole,
      departmentId: row.departmentId,
      evidenceKind: row.evidenceKind,
      activityType: row.activityType,
      originalDescription: row.originalDescription ?? row.normalizedActivity,
      normalizedActivity: row.normalizedActivity,
      category: row.category,
      tools: stringArray(row.toolsJson),
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      durationMinutes: Number(row.durationMinutes),
      source: row.source,
      confidence: Number(row.confidence),
      confirmationState: row.confirmationState,
      recurrenceHints: stringArray(row.recurrenceHintsJson),
      humanJudgment: Number(row.humanJudgment),
      operationalRisk: Number(row.operationalRisk),
      metadata: objectRecord(row.metadataJson),
      provenance: stringArray(row.provenanceJson),
      supersedesActivityId: row.supersedesActivityId,
      retentionPolicy: { policyId: row.retentionPolicyId, version: row.retentionPolicyVersion },
      capturedBy: row.capturedBy,
      confirmedBy: row.confirmedBy,
      confirmedAt: row.confirmedAt,
    });
  }
}

function stringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string"))
    throw new WorkIntelligenceError("Persisted string array is invalid");
  return Object.freeze(value);
}

function objectRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new WorkIntelligenceError("Persisted metadata is invalid");
  return Object.freeze(value as Record<string, unknown>);
}
