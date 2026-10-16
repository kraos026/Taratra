import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), call: vi.fn() }));
vi.mock("./agent-company-runtime", () => ({ agentCompanyRuntimeAccess: mocks.access }));
vi.mock("../infrastructure/free-pilot-client", () => ({ callFreePilot: mocks.call }));
import { freePilotCreate, freePilotRead, freePilotStop, freePilotReview } from "./free-pilot";
const id = "11111111-1111-4111-8111-111111111111";
const body = { id, prompt: "Produire un plan d’accueil client" };
const item = {
  ...body,
  status: "queued",
  created_at: 123,
  updated_at: 123,
  output: null,
  proof: null,
  error: null,
};
const request = (value: unknown = body, origin = "https://optivos.test") =>
  new Request("https://optivos.test/api/pilot", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.access.mockResolvedValue({ userId: "verified-owner", canWrite: true });
});
describe("real text mission application boundary", () => {
  it("checks review identity, role, origin and schema before forwarding the server author", async () => {
    const review = {
      id,
      decision: "changes_requested",
      comment: "Préciser les responsabilités",
      previousId: null,
    };
    mocks.access.mockResolvedValue(new Response(null, { status: 404 }));
    expect((await freePilotReview(id, id, request(review))).status).toBe(404);
    mocks.access.mockResolvedValue({ canWrite: false });
    expect((await freePilotReview(id, id, request(review))).status).toBe(403);
    mocks.access.mockResolvedValue({ canWrite: true, userId: "owner" });
    expect((await freePilotReview(id, id, request(review, "https://foreign.test"))).status).toBe(
      403,
    );
    expect((await freePilotReview(id, id, request({ ...review, userId: "forged" }))).status).toBe(
      400,
    );
    expect((await freePilotReview(id, id, request({ ...review, comment: "court" }))).status).toBe(
      400,
    );
    expect(mocks.call).not.toHaveBeenCalled();
    mocks.call.mockResolvedValue({ status: 200, data: { data: item } });
    expect((await freePilotReview(id, id, request(review))).status).toBe(200);
    expect(mocks.call).toHaveBeenCalledExactlyOnceWith(id, `/pilot/missions/${id}/review`, {
      ...review,
      userId: "owner",
    });
    mocks.call.mockResolvedValue({ status: 409 });
    expect((await freePilotReview(id, id, request(review))).status).toBe(409);
  });
  it("checks workspace access before every read, create and stop", async () => {
    mocks.access.mockResolvedValue(new Response(null, { status: 404 }));
    expect((await freePilotCreate(id, request())).status).toBe(404);
    expect((await freePilotRead(id, "missions")).status).toBe(404);
    expect((await freePilotStop(id, id, request({}))).status).toBe(404);
    expect(mocks.call).not.toHaveBeenCalled();
  });
  it("rejects viewer mutations and forged origins or model/identity fields before dispatch", async () => {
    mocks.access.mockResolvedValue({ canWrite: false });
    expect((await freePilotCreate(id, request())).status).toBe(403);
    expect((await freePilotStop(id, id, request({}))).status).toBe(403);
    mocks.access.mockResolvedValue({ userId: "owner", canWrite: true });
    expect((await freePilotCreate(id, request(body, "https://foreign.test"))).status).toBe(403);
    for (const value of [
      { ...body, userId: "forged" },
      { ...body, model: "paid-model" },
      { ...body, organizationId: "foreign" },
      { ...body, prompt: "x".repeat(9000) },
    ])
      expect([400, 413]).toContain((await freePilotCreate(id, request(value))).status);
    expect(mocks.call).not.toHaveBeenCalled();
  });
  it("derives author on the server and retains the UUID without triggering an automatic retry", async () => {
    mocks.call.mockResolvedValue({ status: 202, data: { data: item } });
    const response = await freePilotCreate(id, request());
    expect(response.status).toBe(202);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.call).toHaveBeenCalledExactlyOnceWith(id, "/pilot/missions", {
      ...body,
      userId: "verified-owner",
    });
    mocks.call.mockRejectedValue(new Error("server-only-secret"));
    const failed = await freePilotCreate(id, request());
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("server-only-secret");
    expect(mocks.call).toHaveBeenCalledTimes(2);
  });
  it("preserves idempotency conflicts and queue limits and rejects invented backend states", async () => {
    for (const status of [409, 429]) {
      mocks.call.mockResolvedValue({ status });
      expect((await freePilotCreate(id, request())).status).toBe(status);
    }
    mocks.call.mockResolvedValue({
      status: 200,
      data: { items: [{ ...item, status: "simulated-success" }], hasMore: false },
    });
    expect((await freePilotRead(id, "missions")).status).toBe(503);
  });
});
