import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ context: vi.fn(), from: vi.fn() }));
vi.mock("../infrastructure/agent-company-context", () => ({ agentCompanyContext: mocks.context }));
import { createAgentCompany, listAgentCompanies, linkAgentCompany } from "./agent-companies";
const id = "11111111-1111-4111-8111-111111111111";
const input = {
  id,
  name: "Research team",
  objective: "Prepare a sourced report",
  mode: "guided",
  autonomy: "approval",
  agents: [{ name: "Coordinator", role: "Review sources" }],
  companyId: null,
};
const stored = {
  ...input,
  company_id: null,
  status: "preparation",
  api_budget_euro: 0,
  concurrency_limit: 1,
  created_at: "2026-10-14T12:00:00Z",
  created_by: "owner",
};
const request = (body: unknown = input, origin = "https://optivos.test") =>
  new Request("https://optivos.test/api/atelier-ia/entreprises", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.context.mockResolvedValue({
    client: { from: mocks.from },
    userId: "owner",
    organizationId: "org",
    canWrite: true,
  });
});
function query(result: unknown) {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };
  for (const name of ["select", "eq", "order", "insert", "update"] as const)
    q[name].mockReturnValue(q);
  q.single.mockResolvedValue(result);
  q.maybeSingle.mockResolvedValue(result);
  q.limit.mockResolvedValue(result);
  return q;
}
describe("agent company configuration boundary", () => {
  it("checks auth/tenant/lab before reads or writes", async () => {
    for (const status of [401, 403, 404]) {
      mocks.context.mockResolvedValue(new Response(null, { status }));
      expect((await createAgentCompany(request())).status).toBe(status);
      expect((await listAgentCompanies()).status).toBe(status);
    }
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("rejects viewer writes and foreign origins before a database call", async () => {
    expect((await createAgentCompany(request(input, "https://foreign.test"))).status).toBe(403);
    mocks.context.mockResolvedValue({ canWrite: false });
    expect((await createAgentCompany(request())).status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("rejects oversized, injected and invalid team input", async () => {
    for (const body of [
      { ...input, organization_id: "foreign" },
      { ...input, status: "active" },
      { ...input, agents: [input.agents[0], input.agents[0]] },
      { ...input, objective: "x".repeat(17000) },
    ]) {
      expect([400, 413]).toContain((await createAgentCompany(request(body))).status);
    }
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("derives owner and organization on the server without activating a runtime", async () => {
    const q = query({ data: stored, error: null });
    mocks.from.mockReturnValue(q);
    const response = await createAgentCompany(request());
    expect(response.status).toBe(201);
    expect(q.insert).toHaveBeenCalledWith(
      expect.objectContaining({ organization_id: "org", created_by: "owner", company_id: null }),
    );
    expect(q.insert.mock.calls[0][0]).not.toHaveProperty("status");
    expect((await response.json()).data.status).toBe("preparation");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("replays the same creation id without overwriting a different configuration", async () => {
    for (const same of [true, false]) {
      mocks.from
        .mockReturnValueOnce(query({ error: { code: "23505" } }))
        .mockReturnValueOnce(
          query({ data: { ...stored, name: same ? input.name : "Other team" }, error: null }),
        );
      expect((await createAgentCompany(request())).status).toBe(same ? 200 : 409);
    }
  });
  it("scopes listing and links to the canonical organization", async () => {
    const q = query({ data: [], error: null });
    mocks.from.mockReturnValue(q);
    expect((await listAgentCompanies()).status).toBe(200);
    expect(q.eq).toHaveBeenCalledWith("organization_id", "org");
    expect(q.limit).toHaveBeenCalledWith(21);
    const link = query({ data: stored, error: null });
    mocks.from.mockReturnValue(link);
    expect((await linkAgentCompany(id, request({ companyId: null }))).status).toBe(200);
    expect(link.update).toHaveBeenCalledWith({ company_id: null });
    expect(link.eq).toHaveBeenCalledWith("id", id);
    expect(link.eq).toHaveBeenCalledWith("organization_id", "org");
  });
  it("sanitizes failures and rejects malformed identifiers", async () => {
    mocks.from.mockImplementation(() => {
      throw new Error("private-key");
    });
    const response = await createAgentCompany(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private-key");
    expect((await linkAgentCompany("bad", request())).status).toBe(404);
  });
});
