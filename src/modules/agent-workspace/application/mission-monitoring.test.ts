import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), list: vi.fn(), find: vi.fn(), read: vi.fn() }));
vi.mock("./agent-workspace-access", () => ({ loadAgentCompany: mocks.access }));
vi.mock("../infrastructure/mission-link-repository", () => ({
  listMissionLinks: mocks.list,
  findMissionRun: mocks.find,
}));
vi.mock("../infrastructure/hermes-mission-client", () => ({ readHermesMission: mocks.read }));
import { listCompanyMissions, observeCompanyMission } from "./mission-monitoring";
const company = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.access.mockResolvedValue({ id: company });
});
describe("mission monitoring access order", () => {
  it("denies lab/auth/company access before the registry or Hermes", async () => {
    for (const status of [401, 403, 404]) {
      mocks.access.mockResolvedValue(new Response(null, { status }));
      expect((await listCompanyMissions(company)).status).toBe(status);
      mocks.access.mockResolvedValue(new Response(null, { status }));
      expect((await observeCompanyMission(company, id)).status).toBe(status);
    }
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("consults Hermes only after resolving a persisted link in the verified company", async () => {
    mocks.find.mockResolvedValue("run_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    mocks.read.mockResolvedValue({ availability: "available", status: "running" });
    const response = await observeCompanyMission(company, id);
    expect(mocks.find).toHaveBeenCalledWith(company, id);
    expect(mocks.read).toHaveBeenCalledWith(company, "run_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.json()).data.status).toBe("running");
  });
  it("cannot observe an unknown link or use a raw Hermes run ID as a link", async () => {
    mocks.find.mockResolvedValue(null);
    expect((await observeCompanyMission(company, id)).status).toBe(404);
    expect(
      (await observeCompanyMission(company, "run_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).status,
    ).toBe(404);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("uses bounded repository data without an upstream fetch for listing", async () => {
    mocks.list.mockResolvedValue({ items: [], hasMore: false });
    expect(await (await listCompanyMissions(company)).json()).toEqual({
      data: { items: [], hasMore: false },
    });
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("sanitizes database failures instead of leaking run IDs or connection details", async () => {
    mocks.find.mockRejectedValue(new Error("secret"));
    const response = await observeCompanyMission(company, id);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret");
  });
});
