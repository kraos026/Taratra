import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  from: vi.fn(),
  health: vi.fn(),
  inventory: vi.fn(),
}));
vi.mock("../infrastructure/agent-company-context", () => ({ agentCompanyContext: mocks.context }));
vi.mock("../infrastructure/hermes-health-client", () => ({ readHermesConnection: mocks.health }));
vi.mock("../infrastructure/hermes-inventory-client", () => ({
  readHermesInventory: mocks.inventory,
}));
import { readAgentCompanyRuntime } from "./agent-company-runtime";

const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.context.mockResolvedValue({
    client: { from: mocks.from },
    organizationId: "own-org",
    canWrite: false,
  });
});
function query(result: unknown) {
  const q = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue(result) };
  q.select.mockReturnValue(q);
  q.eq.mockReturnValue(q);
  mocks.from.mockReturnValue(q);
  return q;
}
describe("standalone company runtime consultation", () => {
  it("refuses unauthenticated, tenantless and disabled-lab access before DB or network", async () => {
    for (const status of [401, 403, 404, 503]) {
      mocks.context.mockResolvedValue(new Response(null, { status }));
      for (const kind of ["connection", "inventory"] as const)
        expect((await readAgentCompanyRuntime(id, kind)).status).toBe(status);
    }
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.health).not.toHaveBeenCalled();
    expect(mocks.inventory).not.toHaveBeenCalled();
  });
  it("rejects malformed, absent or foreign workspace before network", async () => {
    expect((await readAgentCompanyRuntime("bad-id", "connection")).status).toBe(404);
    expect(mocks.from).not.toHaveBeenCalled();
    const q = query({ data: null, error: null });
    for (const kind of ["connection", "inventory"] as const)
      expect((await readAgentCompanyRuntime(id, kind)).status).toBe(404);
    expect(q.eq).toHaveBeenCalledWith("organization_id", "own-org");
    expect(q.eq).toHaveBeenCalledWith("id", id);
    expect(mocks.health).not.toHaveBeenCalled();
    expect(mocks.inventory).not.toHaveBeenCalled();
  });
  it("fails closed on DB errors and unexpected IDs without private error content", async () => {
    for (const result of [
      { data: null, error: { message: "private-database-secret" } },
      { data: { id: "wrong" }, error: null },
    ]) {
      query(result);
      const response = await readAgentCompanyRuntime(id, "connection");
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain("private-database-secret");
    }
    expect(mocks.health).not.toHaveBeenCalled();
    expect(mocks.inventory).not.toHaveBeenCalled();
  });
  it("allows an authorized reader through the workspace scope only, without audit linkage", async () => {
    query({ data: { id }, error: null });
    mocks.health.mockResolvedValue({ state: "connected", liveExecution: false, modelCalls: 0 });
    mocks.inventory.mockResolvedValue({ skills: { state: "available", items: [] }, modelCalls: 0 });
    const response = await readAgentCompanyRuntime(id, "connection");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      data: { state: "connected", liveExecution: false, modelCalls: 0 },
    });
    expect(mocks.health).toHaveBeenCalledExactlyOnceWith({ workspaceId: id });
    expect((await readAgentCompanyRuntime(id, "inventory")).status).toBe(200);
    expect(mocks.inventory).toHaveBeenCalledExactlyOnceWith({ workspaceId: id });
    expect(mocks.from.mock.calls.every(([table]) => table === "agent_company_workspaces")).toBe(
      true,
    );
  });
});
