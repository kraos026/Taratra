import { describe, expect, it } from "vitest";

import type { WorkActivityRepository } from "@/modules/work-intelligence/application/work-activity-repository";
import { WorkActivity } from "@/modules/work-intelligence/domain/work-intelligence";
import { ProjectConfirmedWorkIntelligenceToKnowledge } from "./project-work-intelligence-to-knowledge";

const tenantId = "52000000-0000-4000-8000-000000000001";
const companyId = "52000000-0000-4000-8000-000000000002";
const activityId = "52000000-0000-4000-8000-000000000003";
const lineageId = "52000000-0000-4000-8000-000000000004";
const userId = "52000000-0000-4000-8000-000000000005";

function activity(state: "PENDING" | "CONFIRMED" | "CORRECTED" = "CONFIRMED") {
  return WorkActivity.create({
    activityId,
    lineageId,
    version: 2,
    tenantId,
    companyId,
    actorRole: "operations",
    evidenceKind: "OBSERVED",
    activityType: "WORK",
    originalDescription: "Prepare weekly operational report",
    normalizedActivity: "PREPARE_OPERATIONAL_REPORT",
    category: "Reporting",
    tools: ["spreadsheet"],
    startedAt: new Date("2026-08-01T09:00:00Z"),
    durationMinutes: 45,
    source: "MANUAL",
    confidence: 100,
    confirmationState: state,
    humanJudgment: 20,
    operationalRisk: 30,
    metadata: { source: "fixture" },
    provenance: ["capture:daily-work"],
    supersedesActivityId: state === "CORRECTED" ? "52000000-0000-4000-8000-000000000006" : null,
    retentionPolicy: {
      policyId: "52000000-0000-4000-8000-000000000007",
      version: 1,
    },
  });
}

function repository(current = activity()): WorkActivityRepository {
  return {
    append: async () => undefined,
    appendBatch: async () => undefined,
    get: async () => current,
    latest: async () => current,
    list: async () => [current],
    history: async () => [current],
  };
}

function knowledgeRepository(role = "consultant") {
  const calls: unknown[][] = [];
  return {
    calls,
    contextForOrganization: async () => ({ organizationId: tenantId, role }),
    persist: async (...args: unknown[]) => {
      calls.push(args);
      return { id: "snapshot", status: "ready" };
    },
  };
}

describe("ProjectConfirmedWorkIntelligenceToKnowledge", () => {
  it("projects CONFIRMED activity with exact Work Intelligence provenance", async () => {
    const knowledge = knowledgeRepository();
    await new ProjectConfirmedWorkIntelligenceToKnowledge(
      knowledge as never,
      repository(),
      userId,
      { now: () => new Date("2026-08-02T00:00:00Z") },
    ).execute({ tenantId, companyId, activityId });
    const projection = knowledge.calls[0]![3] as {
      sources: { type: string; sourceId: string; version: number }[];
      facts: { sourceRecordType: string; sourceRecordId: string; evidenceType: string }[];
    };
    expect(projection.sources[0]).toMatchObject({
      type: "work_intelligence",
      sourceId: lineageId,
      version: 2,
    });
    expect(projection.facts[0]).toMatchObject({
      sourceRecordType: "work_activity_version",
      sourceRecordId: activityId,
      evidenceType: "confirmed_work_activity",
    });
  });

  it("projects CORRECTED activity with corrected evidence type", async () => {
    const knowledge = knowledgeRepository();
    await new ProjectConfirmedWorkIntelligenceToKnowledge(
      knowledge as never,
      repository(activity("CORRECTED")),
      userId,
      { now: () => new Date("2026-08-02T00:00:00Z") },
    ).execute({ tenantId, companyId, activityId });
    const projection = knowledge.calls[0]![3] as { facts: { evidenceType: string }[] };
    expect(projection.facts.every((fact) => fact.evidenceType === "corrected_work_activity")).toBe(
      true,
    );
  });

  it("rejects unconfirmed activity before snapshot write", async () => {
    const knowledge = knowledgeRepository();
    await expect(
      new ProjectConfirmedWorkIntelligenceToKnowledge(
        knowledge as never,
        repository(activity("PENDING")),
        userId,
        { now: () => new Date("2026-08-02T00:00:00Z") },
      ).execute({ tenantId, companyId, activityId }),
    ).rejects.toThrow("confirmed or corrected");
    expect(knowledge.calls).toHaveLength(0);
  });

  it("rejects non-current superseded activity", async () => {
    const old = activity("CONFIRMED");
    const newer = WorkActivity.create({
      activityId: "52000000-0000-4000-8000-000000000008",
      lineageId: old.lineageId,
      tenantId: old.tenantId,
      companyId: old.companyId,
      actorRole: old.actorRole,
      departmentId: old.departmentId,
      evidenceKind: old.evidenceKind,
      activityType: old.activityType,
      originalDescription: old.originalDescription,
      normalizedActivity: old.normalizedActivity,
      category: old.category,
      tools: old.tools,
      startedAt: old.startedAt,
      endedAt: old.endedAt,
      durationMinutes: old.durationMinutes,
      source: old.source,
      confidence: old.confidence,
      confirmationState: old.confirmationState,
      recurrenceHints: old.recurrenceHints,
      humanJudgment: old.humanJudgment,
      operationalRisk: old.operationalRisk,
      metadata: old.metadata,
      provenance: old.provenance,
      retentionPolicy: old.retentionPolicy ?? undefined,
      version: 3,
      supersedesActivityId: old.activityId,
    });
    const workActivities: WorkActivityRepository = {
      ...repository(old),
      latest: async () => newer,
    };
    await expect(
      new ProjectConfirmedWorkIntelligenceToKnowledge(
        knowledgeRepository() as never,
        workActivities,
        userId,
        { now: () => new Date("2026-08-02T00:00:00Z") },
      ).execute({ tenantId, companyId, activityId }),
    ).rejects.toThrow("current");
  });

  it("requires owner, admin or consultant authorization", async () => {
    await expect(
      new ProjectConfirmedWorkIntelligenceToKnowledge(
        knowledgeRepository("viewer") as never,
        repository(),
        userId,
        { now: () => new Date("2026-08-02T00:00:00Z") },
      ).execute({ tenantId, companyId, activityId }),
    ).rejects.toThrow("not permitted");
  });
});
