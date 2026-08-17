import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClaims, withAuthenticatedDatabase, ask } = vi.hoisted(() => ({
  getClaims: vi.fn(),
  withAuthenticatedDatabase: vi.fn(),
  ask: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getClaims } })),
}));

vi.mock("@/infrastructure/database/with-authenticated-database", () => ({
  withAuthenticatedDatabase,
}));

vi.mock("@/modules/company-intake/application/ask-automatex", () => ({
  AskAutomateXService: vi.fn().mockImplementation(function () {
    return { ask };
  }),
}));

import { POST } from "./route";

describe("POST /api/companies/:id/automation-audit/ask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-a" } }, error: null });
    withAuthenticatedDatabase.mockImplementation(async (_userId, operation) =>
      operation(database({ companyVisible: true })),
    );
    ask.mockResolvedValue({
      answer: "Grounded answer",
      answerStatus: "ANSWERED",
      intent: { intentType: "WHY_DECISION" },
      supportingEvidence: [],
    });
  });

  it("rejects unauthenticated requests before tenant context is loaded", async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error("invalid") });

    const response = await POST(request({ question: "Why?" }), {
      params: Promise.resolve({ id: "company-a" }),
    });

    expect(response.status).toBe(401);
    expect(withAuthenticatedDatabase).not.toHaveBeenCalled();
  });

  it("loads tenant and company before asking through the product read path", async () => {
    const response = await POST(request({ question: "Why should we fix this first?" }), {
      params: Promise.resolve({ id: "company-a" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { answer: "Grounded answer", answerStatus: "ANSWERED" },
    });
    expect(withAuthenticatedDatabase).toHaveBeenCalledWith("user-a", expect.any(Function));
    expect(ask).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      companyId: "company-a",
      userId: "user-a",
      question: "Why should we fix this first?",
      context: undefined,
    });
  });

  it("hard rejects cross-company access before Ask context is built", async () => {
    withAuthenticatedDatabase.mockImplementation(async (_userId, operation) =>
      operation(database({ companyVisible: false })),
    );

    const response = await POST(request({ question: "Show me the evidence." }), {
      params: Promise.resolve({ id: "company-b" }),
    });

    expect(response.status).toBe(404);
    expect(ask).not.toHaveBeenCalled();
  });

  it("validates input without accepting caller-submitted evidence or decision state", async () => {
    const response = await POST(request({ question: "" }), {
      params: Promise.resolve({ id: "company-a" }),
    });

    expect(response.status).toBe(400);
    expect(ask).not.toHaveBeenCalled();
  });
});

function request(body: unknown): Request {
  return new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify(body),
  });
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
