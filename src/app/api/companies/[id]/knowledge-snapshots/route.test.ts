import { beforeEach, describe, expect, it, vi } from "vitest";

const { withEnterpriseKnowledgeService } = vi.hoisted(() => ({
  withEnterpriseKnowledgeService: vi.fn(),
}));
vi.mock("@/modules/knowledge/presentation/knowledge-api", () => ({
  withEnterpriseKnowledgeService,
}));

import { POST } from "./route";

describe("POST /api/companies/:id/knowledge-snapshots", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects invalid route identities", async () => {
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });
    expect(response.status).toBe(400);
    expect(withEnterpriseKnowledgeService).not.toHaveBeenCalled();
  });

  it.each([
    [true, 201],
    [false, 200],
  ])("returns the safe application DTO when created=%s", async (created, status) => {
    withEnterpriseKnowledgeService.mockImplementation(async (operation) =>
      operation({
        build: vi.fn().mockResolvedValue({
          snapshot: {
            id: "33333333-3333-4333-8333-333333333333",
            companyId: "11111111-1111-4111-8111-111111111111",
            organizationId: "must-not-leak",
            createdBy: "must-not-leak",
            status: "ready",
            version: 4,
          },
          created,
        }),
      }),
    );
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
    });
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        id: "33333333-3333-4333-8333-333333333333",
        companyId: "11111111-1111-4111-8111-111111111111",
        status: "ready",
        version: 4,
        created,
      },
    });
  });
});
