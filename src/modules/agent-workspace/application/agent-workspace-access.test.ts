import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const service = vi.hoisted(() => ({
  get: vi.fn(),
  permissions: vi.fn(),
  list: vi.fn(),
  authenticated: true,
}));
const call = vi.hoisted(() => vi.fn());
vi.mock("@/modules/companies/presentation/company-api", () => ({
  withCompanyService: (
    name: string,
    operation: (value: typeof service, userId: string) => unknown,
  ) => {
    call(name);
    return service.authenticated
      ? operation(service, "verified-user")
      : new Response(null, { status: 401 });
  },
}));
import { loadAgentCompanies, loadAgentCompany } from "./agent-workspace-access";
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.clearAllMocks();
  service.authenticated = true;
  vi.stubEnv("NEXT_PUBLIC_OPTIVOS_ATELIER_IA_LAB", "1");
  vi.stubEnv("AUTOMATEX_CERTIFICATION_TARGET", "local");
  vi.stubEnv("VERCEL_ENV", undefined);
  service.get.mockResolvedValue({
    id,
    name: "Test entreprise",
    status: "client",
    deletedAt: null,
    internalNotes: "private notes",
    organizationId: "organization-a",
  });
  service.permissions.mockResolvedValue({ canWrite: true });
});
afterEach(() => vi.unstubAllEnvs());
describe("Atelier IA reuses canonical company access", () => {
  it("does not query an engine or company when the flag, target or identifier is invalid", async () => {
    expect(((await loadAgentCompany("wrong-id")) as Response).status).toBe(404);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(((await loadAgentCompany(id)) as Response).status).toBe(404);
    expect(call).not.toHaveBeenCalled();
    expect(service.get).not.toHaveBeenCalled();
  });
  it("uses the existing authenticated facade and passes through unauthenticated denial", async () => {
    service.authenticated = false;
    expect(((await loadAgentCompany(id)) as Response).status).toBe(401);
    expect(service.get).not.toHaveBeenCalled();
  });
  it("projects only the company identifier, label and permission into the panel", async () => {
    expect(await loadAgentCompany(id)).toEqual({ id, name: "Test entreprise", canWrite: true });
    expect(service.get).toHaveBeenCalledWith(id);
    expect(call).toHaveBeenCalledWith("agent-workspace.company.read");
  });
  it("does not expose a mismatched, deleted or archived company", async () => {
    for (const patch of [
      { id: "other-company" },
      { deletedAt: new Date() },
      { status: "archived" },
    ]) {
      service.get.mockResolvedValue({
        id,
        name: "Hidden",
        status: "client",
        deletedAt: null,
        ...patch,
      });
      expect(((await loadAgentCompany(id)) as Response).status).toBe(404);
    }
    expect(service.permissions).not.toHaveBeenCalled();
  });
  it("keeps viewer permissions read only", async () => {
    service.permissions.mockResolvedValue({ canWrite: false });
    expect(await loadAgentCompany(id)).toMatchObject({ canWrite: false });
  });
  it("lists only the companies supplied by the authenticated canonical service, with bounded pagination", async () => {
    service.list.mockResolvedValue({
      items: [{ id, name: "Authorized", internalNotes: "not for the index" }],
      page: 2,
      totalPages: 3,
    });
    expect(await loadAgentCompanies(2)).toEqual({
      companies: [{ id, name: "Authorized" }],
      page: 2,
      totalPages: 3,
    });
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({ pageSize: 20, includeArchived: false, page: 2 }),
    );
  });
});
