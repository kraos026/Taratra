import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const calls = vi.hoisted(() => ({ connect: vi.fn(), query: vi.fn(), end: vi.fn() }));
vi.mock("pg", () => ({
  Client: class {
    connect = calls.connect;
    query = calls.query;
    end = calls.end;
  },
}));
import { GET } from "./route";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_GIT_COMMIT_REF", "astra/optivos-finalization-20260914");
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://postgres.ajvncwsazrhqjlktzojm:synthetic@pooler.invalid/db",
  );
  vi.stubEnv(
    "DIRECT_URL",
    "postgresql://synthetic:synthetic@db.ajvncwsazrhqjlktzojm.supabase.co/db",
  );
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://ajvncwsazrhqjlktzojm.supabase.co");
  calls.query.mockResolvedValue({ rows: [{ server_addr: "192.0.2.1" }] });
  calls.end.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());
describe("preview-only target proof", () => {
  it.each(["production", "development", ""])("is unavailable in %s", async (environment) => {
    vi.stubEnv("VERCEL_ENV", environment);
    expect((await GET()).status).toBe(404);
    expect(calls.connect).not.toHaveBeenCalled();
  });
  it("is unavailable on other branches", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "main");
    expect((await GET()).status).toBe(404);
  });
  it("returns classifications without secrets and without unnecessary SQL", async () => {
    const response = await GET();
    const body = await response.text();
    expect(body).toContain("PREVIEW_ENV_STAGING_COHERENT");
    expect(body).not.toContain("synthetic");
    expect(body).not.toContain("ajvnc");
    expect(calls.connect).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects a mixed environment", async () => {
    vi.stubEnv("DIRECT_URL", "postgresql://a:b@db.mekihopfrfmqnhmtktgr.supabase.co/db");
    expect((await (await GET()).json()).overall).toBe("PREVIEW_ENV_MIXED");
  });
  it("does not treat a missing variable as staging", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect((await (await GET()).json()).overall).toBe("PREVIEW_ENV_UNKNOWN");
  });
  it("uses only a read-only metadata transaction for unknown identities", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://a:b@unknown.invalid/db");
    expect((await (await GET()).json()).databaseUrl).toBe("UNKNOWN");
    expect(calls.query.mock.calls.map((c) => c[0])).toEqual([
      "BEGIN READ ONLY",
      "SELECT inet_server_addr()::text AS server_addr",
      "ROLLBACK",
    ]);
    expect(calls.end).toHaveBeenCalledOnce();
  });
});
