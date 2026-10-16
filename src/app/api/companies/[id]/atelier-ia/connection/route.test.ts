import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ company: vi.fn(), health: vi.fn() }));
vi.mock("@/modules/agent-workspace/application/agent-workspace-access", () => ({
  loadAgentCompany: mocks.company,
}));
vi.mock("@/modules/agent-workspace/infrastructure/hermes-health-client", () => ({
  readHermesConnection: mocks.health,
}));
import { GET } from "./route";
const id = "11111111-1111-4111-8111-111111111111";
const request = new Request(
  "http://localhost/api/companies/ignored/atelier-ia/connection?company=other&run=private",
);
beforeEach(() => vi.resetAllMocks());
describe("company-scoped Hermes health route", () => {
  it("passes through authentication, access or lab denial before contacting Hermes", async () => {
    for (const status of [401, 403, 404, 500]) {
      mocks.company.mockResolvedValue(new Response(null, { status }));
      const response = await GET(request, { params: Promise.resolve({ id }) });
      expect(response.status).toBe(status);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(mocks.health).not.toHaveBeenCalled();
  });
  it("uses the verified company, ignores query destinations and disallows cached health", async () => {
    mocks.company.mockResolvedValue({ id, name: "Verified", canSimulate: false });
    mocks.health.mockResolvedValue({ state: "unconfigured", liveExecution: false, modelCalls: 0 });
    const response = await GET(request, { params: Promise.resolve({ id }) });
    expect(mocks.company).toHaveBeenCalledWith(id);
    expect(mocks.health).toHaveBeenCalledWith(id);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      data: { state: "unconfigured", liveExecution: false, modelCalls: 0 },
    });
  });
});
