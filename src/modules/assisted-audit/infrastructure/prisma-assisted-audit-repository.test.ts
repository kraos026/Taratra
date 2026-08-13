import { describe, expect, it, vi } from "vitest";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import { PrismaAssistedAuditRepository } from "./prisma-assisted-audit-repository";

describe("PrismaAssistedAuditRepository", () => {
  it("resolves company data through the authenticated tenant", async () => {
    const db = database();
    db.organizationMember.findFirst.mockResolvedValue({ organizationId: "org-a", role: "owner" });
    db.company.findFirst.mockResolvedValue({ id: "company-a", name: "Company A" });
    const result = await new PrismaAssistedAuditRepository(asDb(db)).read("user-a", "company-a");
    expect(result?.company).toEqual({ id: "company-a", name: "Company A" });
    expect(db.company.findFirst).toHaveBeenCalledWith({
      where: { id: "company-a", organizationId: "org-a" },
      select: { id: true, name: true },
    });
  });

  it("returns no state for a cross-tenant company", async () => {
    const db = database();
    db.organizationMember.findFirst.mockResolvedValue({ organizationId: "org-a", role: "owner" });
    db.company.findFirst.mockResolvedValue(null);
    await expect(
      new PrismaAssistedAuditRepository(asDb(db)).read("user-a", "company-b"),
    ).resolves.toBeNull();
    expect(db.discoverySession.findFirst).not.toHaveBeenCalled();
  });

  it("binds Interview selection to the selected Discovery version", async () => {
    const db = databaseWithCompany();
    db.discoverySession.findFirst.mockResolvedValue(session("discovery-v2", "validated", 2));
    db.interviewSession.findFirst.mockResolvedValue(session("interview", "in_progress", 1));
    const result = await new PrismaAssistedAuditRepository(asDb(db)).read("user", "company");
    expect(result?.interview?.id).toBe("interview");
    expect(db.interviewSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ discoverySessionId: "discovery-v2" }),
      }),
    );
  });

  it("rejects stale Knowledge whose exact source versions do not match", async () => {
    const db = databaseWithCompany();
    db.discoverySession.findFirst.mockResolvedValue(session("discovery", "validated", 2));
    db.interviewSession.findFirst.mockResolvedValue(session("interview", "validated", 3));
    db.knowledgeSnapshot.findMany.mockResolvedValue([
      { id: "stale", version: 4, status: "ready", createdAt: new Date() },
    ]);
    db.knowledgeSource.findMany.mockResolvedValue([
      { sourceType: "discovery", sourceId: "discovery", sourceVersion: 1 },
      { sourceType: "interview", sourceId: "interview", sourceVersion: 3 },
    ]);
    const result = await new PrismaAssistedAuditRepository(asDb(db)).read("user", "company");
    expect(result?.knowledge).toBeNull();
    expect(db.processMap.findMany).not.toHaveBeenCalled();
  });

  it("preserves the exact predecessor IDs through the canonical chain", async () => {
    const db = databaseWithCompany();
    db.discoverySession.findFirst.mockResolvedValue(session("discovery", "validated", 2));
    db.interviewSession.findFirst.mockResolvedValue(session("interview", "validated", 3));
    db.knowledgeSnapshot.findMany.mockResolvedValue([
      { id: "knowledge", version: 1, status: "ready", createdAt: new Date() },
    ]);
    db.knowledgeSource.findMany.mockResolvedValue([
      { sourceType: "discovery", sourceId: "discovery", sourceVersion: 2 },
      { sourceType: "interview", sourceId: "interview", sourceVersion: 3 },
    ]);
    db.processMap.findMany.mockResolvedValue([
      versioned("process-map", "published", { processPatternId: "pattern" }),
    ]);
    db.analysisSnapshot.findMany.mockResolvedValue([
      { ...versioned("analysis", "published"), processMapId: "process-map" },
    ]);
    db.aiOpportunitySnapshot.findFirst.mockResolvedValue(versioned("ai", "published"));
    db.automationOpportunitySnapshot.findFirst.mockResolvedValue(
      versioned("automation", "published"),
    );
    db.roiEvaluationSnapshot.findFirst.mockResolvedValue(versioned("roi", "published"));
    db.recommendationPortfolioSnapshot.findFirst.mockResolvedValue(
      versioned("recommendations", "published"),
    );
    const result = await new PrismaAssistedAuditRepository(asDb(db)).read("user", "company");
    expect(result).toMatchObject({
      knowledge: { id: "knowledge" },
      analysis: { id: "analysis" },
      recommendations: { id: "recommendations" },
    });
    expect(db.analysisSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ processMapId: { in: ["process-map"] } }),
      }),
    );
    expect(db.aiOpportunitySnapshot.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ businessAnalysisId: "analysis" }),
      }),
    );
    expect(db.recommendationPortfolioSnapshot.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ roiSnapshotId: "roi" }) }),
    );
  });
});

function databaseWithCompany() {
  const db = database();
  db.organizationMember.findFirst.mockResolvedValue({ organizationId: "org", role: "owner" });
  db.company.findFirst.mockResolvedValue({ id: "company", name: "Company" });
  return db;
}

function database() {
  return {
    organizationMember: { findFirst: vi.fn().mockResolvedValue(null) },
    company: { findFirst: vi.fn().mockResolvedValue(null) },
    discoverySession: { findFirst: vi.fn().mockResolvedValue(null) },
    interviewSession: { findFirst: vi.fn().mockResolvedValue(null) },
    knowledgeSnapshot: { findMany: vi.fn().mockResolvedValue([]) },
    knowledgeSource: { findMany: vi.fn().mockResolvedValue([]) },
    processMap: { findMany: vi.fn().mockResolvedValue([]) },
    analysisSnapshot: { findMany: vi.fn().mockResolvedValue([]) },
    aiOpportunitySnapshot: { findFirst: vi.fn().mockResolvedValue(null) },
    automationOpportunitySnapshot: { findFirst: vi.fn().mockResolvedValue(null) },
    roiEvaluationSnapshot: { findFirst: vi.fn().mockResolvedValue(null) },
    roiValidation: { findFirst: vi.fn().mockResolvedValue(null) },
    recommendationPortfolioSnapshot: { findFirst: vi.fn().mockResolvedValue(null) },
  };
}

function session(id: string, status: string, version: number) {
  return { id, status, version, lockVersion: 1 };
}

function versioned(id: string, status: string, extra: Record<string, unknown> = {}) {
  return { id, status, versionNumber: 1, lockVersion: 1, ...extra };
}

function asDb(db: ReturnType<typeof database>): TransactionClient {
  return db as unknown as TransactionClient;
}
