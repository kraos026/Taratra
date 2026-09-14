import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ log: vi.fn(), adapter: vi.fn() }));
vi.mock("@/shared/infrastructure/logger", () => ({ logInfo: mocks.log }));
vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class {
    constructor(config: unknown) {
      mocks.adapter(config);
    }
  },
}));
vi.mock("@/generated/prisma/client", () => ({ PrismaClient: class {} }));

const databaseGlobal = globalThis as unknown as { prisma?: unknown };

beforeEach(() => {
  delete databaseGlobal.prisma;
  vi.clearAllMocks();
});
afterEach(() => {
  delete databaseGlobal.prisma;
  vi.unstubAllEnvs();
});

describe("database initialization privacy", () => {
  it("retains connection mode without logging connection identity or credentials", async () => {
    const url =
      "postgresql://private-user:private-password@private.pooler.supabase.com:6543/private-db";
    vi.stubEnv("DATABASE_URL", url);
    const { getPrismaClient } = await import("./prisma");
    getPrismaClient();
    getPrismaClient();
    expect(mocks.adapter).toHaveBeenCalledExactlyOnceWith({ connectionString: url });
    expect(mocks.log).toHaveBeenCalledExactlyOnceWith({
      action: "database.client.init",
      databaseConnectionMode: "transaction-pooler",
    });
    expect(JSON.stringify(mocks.log.mock.calls)).not.toContain("private");
  });

  it("fails closed when the runtime URL is missing", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { getPrismaClient } = await import("./prisma");
    expect(() => getPrismaClient()).toThrow("DATABASE_URL is required");
    expect(mocks.adapter).not.toHaveBeenCalled();
    expect(mocks.log).not.toHaveBeenCalled();
  });
});
