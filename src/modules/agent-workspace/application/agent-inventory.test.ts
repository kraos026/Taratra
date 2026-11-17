import { describe, expect, it, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), read: vi.fn() }));
vi.mock("./agent-workspace-access", () => ({ loadAgentCompany: mocks.access }));
vi.mock("../infrastructure/hermes-inventory-client", () => ({ readHermesInventory: mocks.read }));
import { loadCompanyInventory } from "./agent-inventory";
beforeEach(() => vi.resetAllMocks());
describe("company inventory authorization", () => {
  it("denies lab, auth and company access before any native read", async () => {
    for (const status of [401, 403, 404]) {
      mocks.access.mockResolvedValue(new Response(null, { status }));
      expect((await loadCompanyInventory("foreign")).status).toBe(status);
    }
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("uses the verified company and private no-store response", async () => {
    mocks.access.mockResolvedValue({ id: "verified" });
    mocks.read.mockResolvedValue({ modelCalls: 0 });
    const response = await loadCompanyInventory("requested");
    expect(mocks.read).toHaveBeenCalledWith("verified");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("does not expose upstream errors", async () => {
    mocks.access.mockResolvedValue({ id: "verified" });
    mocks.read.mockRejectedValue(new Error("private-key"));
    const response = await loadCompanyInventory("requested");
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private-key");
  });
});
