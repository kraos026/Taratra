import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import { exportDocumentsAndSummary } from "./audit-document-result-export";
import { ExportLimitError } from "./audit-export-limits";
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/modules/executive-results/application/executive-result-service", () => ({
  ExecutiveResultService: class {
    get = mocks.get;
  },
}));
vi.mock("@/modules/executive-results/infrastructure/prisma-executive-result-repository", () => ({
  PrismaExecutiveResultRepository: class {},
}));
function setup() {
  const db = {
    auditProductionEvidenceSourceRecord: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: "source-a", rawContent: "Synthetic document", sourceVersion: 2 },
        ]),
    },
    auditProductionEvidenceRecord: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { sourceId: "source-a", confidence: 0, content: "Synthetic evidence" },
        ]),
    },
  };
  return {
    db,
    run: () =>
      exportDocumentsAndSummary(db as unknown as TransactionClient, "user", "org-a", "company-a"),
  };
}
describe("document content and current canonical summary export", () => {
  beforeEach(() => {
    mocks.get.mockReset().mockResolvedValue({
      organizationId: "org-a",
      company: { id: "company-a", name: "A" },
      complete: false,
      overview: { processes: 0 },
      process: null,
      findings: [],
      opportunities: [],
      roi: null,
      recommendations: [],
      provenance: null,
      internalSecret: "must not export",
    });
  });
  it("exports stored content scoped by company, tenant and source lineage", async () => {
    const { db, run } = setup();
    const result = await run();
    expect(result.documentSources[0].rawContent).toBe("Synthetic document");
    expect(result.acquiredEvidence[0].confidence).toBe(0);
    expect(db.auditProductionEvidenceSourceRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-a", companyId: "company-a" },
        take: 1001,
      }),
    );
    expect(db.auditProductionEvidenceRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-a", companyId: "company-a", sourceId: { in: ["source-a"] } },
        take: 1001,
      }),
    );
    expect(mocks.get).toHaveBeenCalledWith("company-a");
    expect(result.currentSummary.complete).toBe(false);
    expect(result.currentSummary.roi).toBeNull();
    expect(result.currentSummary).not.toHaveProperty("organizationId");
    expect(result.currentSummary).not.toHaveProperty("internalSecret");
  });
  it.each([
    null,
    { company: { id: "company-b" } },
    { company: { id: "company-a" }, organizationId: "org-b" },
  ])("rejects absent or cross-scope result", async (result) => {
    mocks.get.mockResolvedValue(result);
    await expect(setup().run()).rejects.toMatchObject({ status: 404 });
  });
  it("does not fabricate evidence when sources are absent", async () => {
    const { db, run } = setup();
    db.auditProductionEvidenceSourceRecord.findMany.mockResolvedValue([]);
    expect((await run()).acquiredEvidence).toEqual([]);
    expect(db.auditProductionEvidenceRecord.findMany).not.toHaveBeenCalled();
  });
  it("rejects excessive sources before reading the executive summary", async () => {
    const { db, run } = setup();
    db.auditProductionEvidenceSourceRecord.findMany.mockResolvedValue(
      Array.from({ length: 1001 }, () => ({ id: "s" })),
    );
    await expect(run()).rejects.toBeInstanceOf(ExportLimitError);
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("preserves unknown and zero ROI rather than recalculating", async () => {
    const baseline = await mocks.get();
    mocks.get.mockResolvedValue({
      ...baseline,
      complete: true,
      roi: { currency: "EUR", evaluations: [{ annualBenefit: 0, roi: null }] },
    });
    const result = await setup().run();
    expect(result.currentSummary.roi?.evaluations[0]).toEqual({ annualBenefit: 0, roi: null });
  });
});
