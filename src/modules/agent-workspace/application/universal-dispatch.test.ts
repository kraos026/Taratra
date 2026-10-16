import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), call: vi.fn() }));
vi.mock("./agent-company-runtime", () => ({ agentCompanyRuntimeAccess: mocks.access }));
vi.mock("../infrastructure/free-pilot-client", () => ({ callFreePilot: mocks.call }));
import { dispatchWorkspaceMission, readWorkspaceEngines } from "./universal-dispatch";
import { createEngineRegistry, engineRegistry } from "../domain/engine-registry";
const id = "11111111-1111-4111-8111-111111111111";
const mission = {
  id: "22222222-2222-4222-8222-222222222222",
  prompt: "Préparer un plan d’accueil client",
};
const input = { version: 1, engineId: "hermes", capability: "text.generate", mission };
function request(
  body: unknown = input,
  origin = "https://optivos.test",
  contentType = "application/json",
) {
  return new Request("https://optivos.test/api/dispatch", {
    method: "POST",
    headers: { origin, "content-type": contentType },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.access.mockResolvedValue({ userId: "server-owner", canWrite: true });
  mocks.call.mockResolvedValue({
    status: 202,
    data: {
      data: {
        ...mission,
        status: "queued",
        created_at: 123,
        updated_at: 123,
        output: null,
        proof: null,
        error: null,
      },
    },
  });
});
describe("universal orchestration boundary", () => {
  it("reads a tenant-gated catalog without contacting any engine", async () => {
    mocks.access.mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect((await readWorkspaceEngines(id)).status).toBe(404);
    const response = await readWorkspaceEngines(id);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.data.engines).toHaveLength(9);
    expect(body.data.health).toBe("not-checked");
    expect(mocks.call).not.toHaveBeenCalled();
  });
  it("keeps the original durable mission UUID and derives its author through the existing adapter", async () => {
    expect((await dispatchWorkspaceMission(id, request())).status).toBe(202);
    expect(mocks.call).toHaveBeenCalledExactlyOnceWith(id, "/pilot/missions", {
      ...mission,
      userId: "server-owner",
    });
    expect(mocks.access).toHaveBeenCalledTimes(2);
  });
  it("checks workspace and write access before parsing or dispatching", async () => {
    mocks.access.mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect((await dispatchWorkspaceMission(id, request())).status).toBe(404);
    mocks.access.mockResolvedValueOnce({ canWrite: false });
    expect((await dispatchWorkspaceMission(id, request())).status).toBe(403);
    expect(mocks.call).not.toHaveBeenCalled();
  });
  it("rejects origin, media type, oversized input and forged execution parameters", async () => {
    expect(
      (await dispatchWorkspaceMission(id, request(input, "https://foreign.test"))).status,
    ).toBe(403);
    expect(
      (await dispatchWorkspaceMission(id, request(input, "https://optivos.test", "text/plain")))
        .status,
    ).toBe(415);
    expect(
      (
        await dispatchWorkspaceMission(
          id,
          request({ ...input, mission: { ...mission, prompt: "x".repeat(9000) } }),
        )
      ).status,
    ).toBe(413);
    for (const value of [
      { ...input, version: 2 },
      { ...input, model: "paid" },
      { ...input, url: "http://127.0.0.1" },
      { ...input, organizationId: "foreign" },
      { ...input, mission: { ...mission, userId: "forged" } },
      { ...input, mission: { ...mission, tools: ["shell"] } },
    ])
      expect((await dispatchWorkspaceMission(id, request(value))).status).toBe(400);
    expect(mocks.call).not.toHaveBeenCalled();
  });
  it("never interprets an available manifest as an executable binding", async () => {
    for (const engine of engineRegistry.filter((entry) => entry.id !== "hermes")) {
      expect(
        (
          await dispatchWorkspaceMission(
            id,
            request({ ...input, engineId: engine.id, capability: engine.capabilities[0].id }),
          )
        ).status,
      ).toBe(409);
    }
    for (const value of [
      { ...input, engineId: "untrusted" },
      { ...input, capability: "shell.execute" },
    ])
      expect((await dispatchWorkspaceMission(id, request(value))).status).toBe(404);
    expect(mocks.call).not.toHaveBeenCalled();
  });
  it("preserves idempotency conflicts and capacity limits without a fallback or retry", async () => {
    for (const status of [409, 429]) {
      mocks.call.mockResolvedValueOnce({ status });
      expect((await dispatchWorkspaceMission(id, request())).status).toBe(status);
    }
    mocks.call.mockRejectedValueOnce(new Error("private-key-not-for-client"));
    const response = await dispatchWorkspaceMission(id, request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private-key-not-for-client");
    expect(mocks.call).toHaveBeenCalledTimes(3);
  });
  it("checks the access again when handing off to the canonical mission boundary", async () => {
    mocks.access
      .mockResolvedValueOnce({ userId: "owner", canWrite: true })
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect((await dispatchWorkspaceMission(id, request())).status).toBe(404);
    expect(mocks.call).not.toHaveBeenCalled();
  });
  it("accepts extension metadata but rejects duplicate identities and embedded secrets or endpoints", () => {
    const example = { ...engineRegistry[1], id: "future-engine", wiring: "planned" };
    expect(createEngineRegistry([example])[0].id).toBe("future-engine");
    expect(() => createEngineRegistry([example, example])).toThrow();
    expect(() =>
      createEngineRegistry([
        { ...example, capabilities: [example.capabilities[0], example.capabilities[0]] },
      ]),
    ).toThrow();
    for (const field of ["apiKey", "endpoint", "command"])
      expect(() => createEngineRegistry([{ ...example, [field]: "unsafe" }])).toThrow();
  });
});
