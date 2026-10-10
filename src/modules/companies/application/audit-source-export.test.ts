import { describe, expect, it, vi } from "vitest";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import { exportAuditSources, ExportLimitError } from "./audit-source-export";
vi.mock("./audit-document-result-export", () => ({
  exportDocumentsAndSummary: vi.fn().mockResolvedValue({
    documentSources: [],
    acquiredEvidence: [],
    currentSummary: { complete: false },
  }),
}));

function setup(role = "owner", company: unknown = { id: "company-a", organizationId: "org-a" }) {
  const db = {
    organizationMember: { findFirst: vi.fn().mockResolvedValue({ organizationId: "org-a", role }) },
    company: { findFirst: vi.fn().mockResolvedValue(company) },
    discoverySession: {
      findMany: vi.fn().mockResolvedValue([{ id: "discovery-a", status: "archived", version: 1 }]),
    },
    interviewSession: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "interview-a", discoverySessionId: "discovery-a" }]),
    },
    discoveryAnswer: { findMany: vi.fn().mockResolvedValue([{ fieldKey: "count", valueJson: 0 }]) },
    interviewAnswer: {
      findMany: vi.fn().mockResolvedValue([{ valueJson: null, skipReason: "unknown" }]),
    },
    interviewEvidence: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return {
    db,
    run: () => exportAuditSources(db as unknown as TransactionClient, "user-a", "company-a"),
  };
}

describe("bounded canonical audit-source export", () => {
  it.each(["viewer", "consultant"])("refuses %s before reading company data", async (role) => {
    const { db, run } = setup(role);
    await expect(run()).rejects.toMatchObject({ status: 403 });
    expect(db.company.findFirst).not.toHaveBeenCalled();
  });
  it("refuses missing membership", async () => {
    const { db, run } = setup();
    db.organizationMember.findFirst.mockResolvedValue(null);
    await expect(run()).rejects.toMatchObject({ status: 403 });
    expect(db.company.findFirst).not.toHaveBeenCalled();
  });
  it.each([
    null,
    { id: "company-a", organizationId: "org-b" },
    { id: "company-b", organizationId: "org-a" },
  ])("fails closed for absent/wrong tenant or ID", async (company) => {
    const { db, run } = setup("admin", company);
    await expect(run()).rejects.toMatchObject({ status: 404 });
    expect(db.discoverySession.findMany).not.toHaveBeenCalled();
  });
  it("scopes each table and child read; preserves zero/null and archives", async () => {
    const { db, run } = setup("admin");
    const result = await run();
    expect(result.scope).toBe("audit_sources_and_current_summary");
    expect(result.discoverySessions[0].status).toBe("archived");
    expect(result.discoveryAnswers[0].valueJson).toBe(0);
    expect(result.interviewAnswers[0].valueJson).toBeNull();
    for (const table of [
      db.discoverySession,
      db.interviewSession,
      db.discoveryAnswer,
      db.interviewAnswer,
      db.interviewEvidence,
    ]) {
      expect(table.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: "org-a" }),
          take: 1001,
          select: expect.not.objectContaining({
            organizationId: true,
            answeredBy: true,
            startedBy: true,
          }),
        }),
      );
    }
    expect(db.interviewAnswer.findMany.mock.calls[0][0].where.interviewSessionId).toEqual({
      in: ["interview-a"],
    });
    expect(result.excluded).toContain("complete_historical_artifacts_and_roi_calculations");
  });
  it("refuses oversize sets without returning a truncated file", async () => {
    const { db, run } = setup();
    db.discoverySession.findMany.mockResolvedValue(
      Array.from({ length: 1001 }, () => ({ id: "d" })),
    );
    await expect(run()).rejects.toBeInstanceOf(ExportLimitError);
    expect(db.discoveryAnswer.findMany).not.toHaveBeenCalled();
  });
  it("does not query child tables for empty sessions", async () => {
    const { db, run } = setup();
    db.discoverySession.findMany.mockResolvedValue([]);
    db.interviewSession.findMany.mockResolvedValue([]);
    expect((await run()).interviewAnswers).toEqual([]);
    expect(db.discoveryAnswer.findMany).not.toHaveBeenCalled();
    expect(db.interviewEvidence.findMany).not.toHaveBeenCalled();
  });
});
