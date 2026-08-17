import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClaims, withAuthenticatedDatabase, listEvidenceRequests, createEvidenceRequest } =
  vi.hoisted(() => ({
    getClaims: vi.fn(),
    withAuthenticatedDatabase: vi.fn(),
    listEvidenceRequests: vi.fn(),
    createEvidenceRequest: vi.fn(),
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
      listEvidenceRequests,
      createEvidenceRequest,
    };
  }),
}));

import { GET, POST } from "./route";

describe("/api/companies/:id/automation-audit/evidence-requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-a" } }, error: null });
    withAuthenticatedDatabase.mockImplementation(async (_userId, operation) =>
      operation(database({ companyVisible: true })),
    );
    listEvidenceRequests.mockResolvedValue([{ requestId: "request-1", status: "REQUESTED" }]);
    createEvidenceRequest.mockImplementation(async (request) => request);
  });

  it("rejects unauthenticated requests before database access", async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error("invalid") });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "company-a" }),
    });

    expect(response.status).toBe(401);
    expect(withAuthenticatedDatabase).not.toHaveBeenCalled();
  });

  it("lists durable evidence requests for the authenticated company tenant", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "company-a" }),
    });

    expect(response.status).toBe(200);
    expect(listEvidenceRequests).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      companyId: "company-a",
    });
  });

  it("hard rejects cross-company creation before parsing body", async () => {
    const json = vi.fn();
    withAuthenticatedDatabase.mockImplementation(async (_userId, operation) =>
      operation(database({ companyVisible: false })),
    );

    const response = await POST({ json } as unknown as Request, {
      params: Promise.resolve({ id: "company-b" }),
    });

    expect(response.status).toBe(404);
    expect(json).not.toHaveBeenCalled();
    expect(createEvidenceRequest).not.toHaveBeenCalled();
  });

  it("creates a durable process evidence request through existing workflow service", async () => {
    const response = await POST(
      request({
        target: "PROCESS_EVIDENCE",
        requestedEvidenceType: "OBSERVATION",
        reason: "Need process proof",
        gapId: "gap-1",
        actionId: "action-1",
      }),
      { params: Promise.resolve({ id: "company-a" }) },
    );

    expect(response.status).toBe(201);
    expect(createEvidenceRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-a",
        companyId: "company-a",
        target: "PROCESS_EVIDENCE",
        requestId: "tenant-a:company-a:action-1",
      }),
    );
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
