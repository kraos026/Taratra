import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClaims, withAuthenticatedDatabase, serviceGet } = vi.hoisted(() => ({
  getClaims: vi.fn(),
  withAuthenticatedDatabase: vi.fn(),
  serviceGet: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getClaims } })),
}));

vi.mock("@/infrastructure/database/with-authenticated-database", () => ({
  withAuthenticatedDatabase,
}));

vi.mock("@/modules/company-intake/application/patron-decision-center", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/modules/company-intake/application/patron-decision-center")
    >();
  return {
    ...actual,
    PatronDecisionCenterService: vi.fn().mockImplementation(function () {
      return { get: serviceGet };
    }),
  };
});

import { GET } from "./route";
import { AssistedAuditError } from "@/modules/assisted-audit/application/assisted-audit-errors";
const companyId = "11111111-1111-4111-8111-111111111111";

describe("GET /api/companies/:id/automation-audit/decision-center", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-a" } }, error: null });
    withAuthenticatedDatabase.mockImplementation(async (_userId, operation) => operation({}));
    serviceGet.mockResolvedValue(decisionCenter());
  });

  it("rejects unauthenticated requests before touching the database", async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error("invalid") });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "company-a" }),
    });

    expect(response.status).toBe(401);
    expect(withAuthenticatedDatabase).not.toHaveBeenCalled();
  });

  it("returns the existing PatronDecisionCenter projection for authenticated users", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: companyId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        executiveDecisionView: { company: { id: companyId, tenantId: "tenant-a" } },
        decisionCenter: { source: "EXECUTIVE_DECISION_VIEW", status: "READY" },
      },
    });
    expect(withAuthenticatedDatabase).toHaveBeenCalledWith("user-a", expect.any(Function), {
      timeout: 10_000,
    });
    expect(serviceGet).toHaveBeenCalledWith({ userId: "user-a", companyId });
  });
  it("rejects malformed identifiers before database access", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "invalid" }),
    });
    expect(response.status).toBe(400);
    expect(withAuthenticatedDatabase).not.toHaveBeenCalled();
  });
  it("returns 404 for inaccessible company data", async () => {
    serviceGet.mockRejectedValue(
      new AssistedAuditError("COMPANY_NOT_FOUND", "internal detail", 404),
    );
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: companyId }),
    });
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("internal detail");
  });
  it("propagates unexpected database failures, never an empty success", async () => {
    serviceGet.mockRejectedValue(new Error("P2028"));
    await expect(
      GET(new Request("http://localhost"), { params: Promise.resolve({ id: companyId }) }),
    ).rejects.toThrow("P2028");
  });
});

function decisionCenter() {
  return {
    status: "READY",
    source: "EXECUTIVE_DECISION_VIEW",
    overview: { companyId, companyName: "Pilot Company" },
    priorityCards: [{ explanation: { source: "FALLBACK" } }],
    sourceView: { company: { id: companyId, tenantId: "tenant-a" } },
  };
}
