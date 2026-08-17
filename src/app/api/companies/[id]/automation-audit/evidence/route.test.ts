import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getClaims,
  withAuthenticatedDatabase,
  updateEvidenceRequestStatus,
  isVersionIngested,
  persistSource,
  persistEvidence,
} = vi.hoisted(() => ({
  getClaims: vi.fn(),
  withAuthenticatedDatabase: vi.fn(),
  updateEvidenceRequestStatus: vi.fn(),
  isVersionIngested: vi.fn(),
  persistSource: vi.fn(),
  persistEvidence: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getClaims } })),
}));

vi.mock("@/infrastructure/database/with-authenticated-database", () => ({
  withAuthenticatedDatabase,
}));

vi.mock("@/modules/company-intake/infrastructure/prisma-durable-audit-workflow-repository", () => ({
  PrismaDurableAuditWorkflowRepository: vi.fn().mockImplementation(function () {
    return {
      updateEvidenceRequestStatus,
    };
  }),
}));

vi.mock(
  "@/modules/company-intake/infrastructure/prisma-production-evidence-ingestion-repository",
  () => ({
    PrismaProductionEvidenceIngestionRepository: vi.fn().mockImplementation(function () {
      return {
        isVersionIngested,
        persistSource,
        persistEvidence,
      };
    }),
  }),
);

import { POST } from "./route";

describe("POST /api/companies/:id/automation-audit/evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-a" } }, error: null });
    withAuthenticatedDatabase.mockImplementation(async (_userId, operation) =>
      operation(database({ companyVisible: true })),
    );
    updateEvidenceRequestStatus.mockImplementation(async (input) => ({
      requestId: input.requestId,
      tenantId: input.tenantId,
      companyId: input.companyId,
      status: input.status,
    }));
    isVersionIngested.mockResolvedValue(false);
    persistSource.mockResolvedValue(undefined);
    persistEvidence.mockResolvedValue(undefined);
  });

  it("rejects unauthenticated evidence before database access", async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error("invalid") });

    const response = await POST(request({}), { params: Promise.resolve({ id: "company-a" }) });

    expect(response.status).toBe(401);
    expect(withAuthenticatedDatabase).not.toHaveBeenCalled();
  });

  it("hard rejects cross-company evidence before parsing or ingestion", async () => {
    const json = vi.fn();
    withAuthenticatedDatabase.mockImplementation(async (_userId, operation) =>
      operation(database({ companyVisible: false })),
    );

    const response = await POST({ json } as unknown as Request, {
      params: Promise.resolve({ id: "company-b" }),
    });

    expect(response.status).toBe(404);
    expect(json).not.toHaveBeenCalled();
    expect(persistSource).not.toHaveBeenCalled();
    expect(persistEvidence).not.toHaveBeenCalled();
  });

  it("ingests structured CSV evidence and updates durable request state", async () => {
    const response = await POST(
      request({
        requestId: "tenant-a:company-a:action-1",
        sourceId: "erp-export",
        sourceVersion: 1,
        sourceType: "CSV_EXPORT",
        structured: {
          columns: ["case_id", "duration"],
          rows: [{ case_id: "1", duration: 10 }],
        },
        origin: "upload://erp-export.csv",
      }),
      { params: Promise.resolve({ id: "company-a" }) },
    );

    expect(response.status).toBe(201);
    expect(updateEvidenceRequestStatus).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ status: "RECEIVED" }),
    );
    expect(updateEvidenceRequestStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "INGESTED" }),
    );
    expect(persistSource).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-a",
        companyId: "company-a",
        sourceId: "erp-export",
      }),
    );
    expect(persistEvidence).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          tenantId: "tenant-a",
          companyId: "company-a",
          provenance: expect.objectContaining({ sourceId: "erp-export" }),
        }),
      ]),
    );
  });

  it("returns deterministic duplicate upload response for same source version", async () => {
    isVersionIngested.mockResolvedValue(true);

    const response = await POST(
      request({
        requestId: "tenant-a:company-a:action-1",
        sourceId: "sop-1",
        sourceVersion: 1,
        sourceType: "SOP",
        rawContent: "Approved SOP",
        origin: "upload://sop-1.txt",
      }),
      { params: Promise.resolve({ id: "company-a" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { duplicate: true, evidenceIds: [] },
    });
    expect(persistEvidence).not.toHaveBeenCalled();
  });
});

function request(body: unknown): Request {
  return new Request("http://localhost", { method: "POST", body: JSON.stringify(body) });
}

function database({ companyVisible }: { readonly companyVisible: boolean }) {
  return {
    organizationMember: {
      findFirst: vi.fn().mockResolvedValue({ organizationId: "tenant-a" }),
    },
    company: {
      findFirst: vi.fn().mockResolvedValue(companyVisible ? { id: "company-a" } : null),
    },
  };
}
