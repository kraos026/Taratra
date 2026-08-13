import { beforeEach, describe, expect, it, vi } from "vitest";

const { withAssistedAuditService } = vi.hoisted(() => ({ withAssistedAuditService: vi.fn() }));
vi.mock("@/modules/assisted-audit/presentation/assisted-audit-api", () => ({
  withAssistedAuditService,
}));

import { GET } from "./route";

describe("GET /api/companies/:id/automation-audit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an invalid company ID", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "invalid" }),
    });
    expect(response.status).toBe(400);
    expect(withAssistedAuditService).not.toHaveBeenCalled();
  });

  it("delegates read-model calculation to the application service", async () => {
    const model = {
      company: { id: "11111111-1111-4111-8111-111111111111", name: "Company" },
      overallStatus: "NOT_STARTED",
      currentStage: "DISCOVERY",
      stages: [],
      nextAction: "START_DISCOVERY",
      blockingReason: null,
    };
    const get = vi.fn().mockResolvedValue(model);
    withAssistedAuditService.mockImplementation(async (operation) => operation({ get }));
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, data: model });
    expect(get).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
  });
});
