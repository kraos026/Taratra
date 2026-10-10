import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ claims: vi.fn(), list: vi.fn(), create: vi.fn(), db: vi.fn() }));
vi.mock("@/infrastructure/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: mocks.claims } }),
}));
vi.mock("@/infrastructure/database/with-authenticated-database", () => ({
  withAuthenticatedDatabase: mocks.db,
}));
vi.mock("@/modules/privacy/application/privacy-request-service", async (original) => ({
  ...(await original<object>()),
  listPrivacyRequests: mocks.list,
  createPrivacyRequest: mocks.create,
}));
import { GET, POST } from "./route";
const payload = {
  id: "00000000-0000-4000-8000-000000000011",
  kind: "ACCESS",
  description: "Sources de mon audit",
};
const request = (body: string = JSON.stringify(payload), origin = "https://local.invalid") =>
  new Request("https://local.invalid/api/privacy-requests", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body,
  });
describe("privacy request HTTP", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.claims.mockResolvedValue({ data: { claims: { sub: "a" } } });
    mocks.db.mockImplementation(async (_id, operation) => operation("db"));
    mocks.list.mockResolvedValue({ requests: [], hasMore: false });
    mocks.create.mockResolvedValue(payload);
  });
  it("serves own private list and authenticated create", async () => {
    const read = await GET();
    expect(read.status).toBe(200);
    expect(read.headers.get("Cache-Control")).toContain("no-store");
    const write = await POST(request());
    expect(write.status).toBe(201);
    expect(write.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(mocks.create).toHaveBeenCalledWith("db", "a", payload);
  });
  it("refuses unauthenticated access before DB", async () => {
    mocks.claims.mockResolvedValue({ data: null });
    expect((await GET()).status).toBe(401);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("rejects cross-origin submission", async () => {
    expect((await POST(request(undefined, "https://foreign.invalid"))).status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each(["{", JSON.stringify({ ...payload, requesterId: "b" })])(
    "rejects invalid body",
    async (body) => {
      expect((await POST(request(body))).status).toBe(400);
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );
  it("bounds payload", async () => {
    expect((await POST(request("x".repeat(8193)))).status).toBe(413);
  });
  it("does not disclose errors", async () => {
    mocks.list.mockRejectedValue(new Error("private"));
    const response = await GET();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});
