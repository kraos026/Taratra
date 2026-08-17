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
      params: Promise.resolve({ id: "company-a" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        executiveDecisionView: { company: { id: "company-a", tenantId: "tenant-a" } },
        decisionCenter: { source: "EXECUTIVE_DECISION_VIEW", status: "READY" },
      },
    });
    expect(withAuthenticatedDatabase).toHaveBeenCalledWith("user-a", expect.any(Function));
    expect(serviceGet).toHaveBeenCalledWith({ userId: "user-a", companyId: "company-a" });
  });
});

function decisionCenter() {
  return {
    status: "READY",
    source: "EXECUTIVE_DECISION_VIEW",
    overview: { companyId: "company-a", companyName: "Pilot Company" },
    priorityCards: [{ explanation: { source: "FALLBACK" } }],
    sourceView: { company: { id: "company-a", tenantId: "tenant-a" } },
  };
}
