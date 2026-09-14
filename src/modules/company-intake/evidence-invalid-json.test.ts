import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ claims: vi.fn(), company: vi.fn() }));
vi.mock("@/infrastructure/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: mocks.claims } }),
}));
vi.mock("@/infrastructure/database/with-authenticated-database", () => ({
  withAuthenticatedDatabase: async (_user: string, operation: (db: unknown) => unknown) =>
    operation({
      organizationMember: { findFirst: async () => ({ organizationId: "org-a" }) },
      company: { findFirst: mocks.company },
    }),
}));
import { POST as upload } from "@/app/api/companies/[id]/automation-audit/evidence/route";
import { POST as requestEvidence } from "@/app/api/companies/[id]/automation-audit/evidence-requests/route";
beforeEach(() => {
  mocks.claims.mockResolvedValue({ data: { claims: { sub: "user-a" } }, error: null });
  mocks.company.mockResolvedValue({ id: "company-a" });
});
describe.each([
  ["upload", upload],
  ["request", requestEvidence],
] as const)("evidence %s boundary", (_label, handler) => {
  const context = { params: Promise.resolve({ id: "company-a" }) };
  const malformed = () =>
    new Request("https://local.example/api/evidence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
  it("returns 400 for malformed JSON instead of an uncaught server error", async () => {
    expect((await handler(malformed(), context)).status).toBe(400);
  });
  it("denies anonymous access before parsing any payload", async () => {
    mocks.claims.mockResolvedValue({ data: null, error: null });
    expect((await handler(malformed(), context)).status).toBe(401);
  });
  it("does not reveal payload validity outside the tenant", async () => {
    mocks.company.mockResolvedValue(null);
    expect((await handler(malformed(), context)).status).toBe(404);
  });
});
