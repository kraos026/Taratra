import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ claims: vi.fn(), export: vi.fn(), transaction: vi.fn() }));
vi.mock("@/infrastructure/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: mocks.claims } }),
}));
vi.mock("@/infrastructure/database/with-authenticated-database", () => ({
  withAuthenticatedDatabase: mocks.transaction,
}));
vi.mock("@/modules/companies/application/audit-source-export", async (original) => ({
  ...(await original<object>()),
  exportAuditSources: mocks.export,
}));
import { GET } from "./route";
import { ExportLimitError } from "@/modules/companies/application/audit-source-export";
import {
  CompanyPermissionError,
  CompanyNotFoundError,
} from "@/modules/companies/domain/company-errors";
const id = "00000000-0000-4000-8000-000000000001";
const request = (value = id) =>
  GET(new Request("https://local.invalid"), { params: Promise.resolve({ id: value }) });
describe("audit source attachment", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.claims.mockResolvedValue({ data: { claims: { sub: "user-a" } } });
    mocks.transaction.mockImplementation(async (_user, operation) => operation("authenticated-db"));
    mocks.export.mockResolvedValue({ scope: "audit_sources_only" });
  });
  it("downloads through the authenticated DB without caching", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledWith("user-a", expect.any(Function), {
      timeout: 20_000,
      isolationLevel: "RepeatableRead",
    });
    expect(mocks.export).toHaveBeenCalledWith("authenticated-db", "user-a", id);
    expect(response.headers.get("Content-Disposition")).toBe(
      `attachment; filename="optivos-sources-audit-${id}.json"`,
    );
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(await response.json()).toEqual({ scope: "audit_sources_only" });
  });
  it("rejects an invalid identifier before Auth or DB", async () => {
    expect((await request("bad\r\n")).status).toBe(400);
    expect(mocks.claims).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("refuses unauthenticated requests", async () => {
    mocks.claims.mockResolvedValue({ data: null, error: new Error("invalid") });
    const response = await request();
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("handles Auth transport failure without exposing content or enabling caching", async () => {
    mocks.claims.mockRejectedValue(new Error("private value"));
    const response = await request();
    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(await response.text()).not.toContain("private value");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it.each([
    [new CompanyPermissionError(), 403],
    [new CompanyNotFoundError(), 404],
    [new ExportLimitError(), 409],
    [new Error("private value"), 500],
  ])("returns private generic errors", async (error, status) => {
    mocks.export.mockRejectedValue(error);
    const response = await request();
    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await response.text()).not.toContain("private value");
  });
  it("refuses oversize JSON without returning an attachment", async () => {
    mocks.export.mockResolvedValue({ text: "x".repeat(10 * 1024 * 1024) });
    const response = await request();
    expect(response.status).toBe(409);
    expect(response.headers.has("Content-Disposition")).toBe(false);
  });
});
