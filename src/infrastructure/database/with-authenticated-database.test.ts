import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  raw: vi.fn(),
  unsafe: vi.fn(),
  transaction: vi.fn(),
  error: vi.fn(),
}));
vi.mock("./prisma", () => ({
  getPrismaClient: () => ({ $transaction: mocks.transaction }),
}));
vi.mock("@/shared/infrastructure/logger", () => ({ logError: mocks.error }));
import { withAuthenticatedDatabase } from "./with-authenticated-database";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async (operation) =>
    operation({ $executeRaw: mocks.raw, $executeRawUnsafe: mocks.unsafe }),
  );
});

describe("authenticated database boundary", () => {
  it("sets a parameterized transaction-local identity and authenticated role before access", async () => {
    const operation = vi.fn().mockResolvedValue("result");
    const options = { timeout: 1000 };
    expect(await withAuthenticatedDatabase("test-user", operation, options)).toBe("result");
    expect(mocks.raw.mock.calls[0][0].join("?")).toBe(
      "select set_config('request.jwt.claim.sub', ?, true)",
    );
    expect(mocks.raw.mock.calls[0][1]).toBe("test-user");
    expect(mocks.unsafe).toHaveBeenCalledExactlyOnceWith("set local role authenticated");
    expect(mocks.raw.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.unsafe.mock.invocationCallOrder[0],
    );
    expect(mocks.unsafe.mock.invocationCallOrder[0]).toBeLessThan(
      operation.mock.invocationCallOrder[0],
    );
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), options);
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("does not run business operations when establishing the RLS context fails", async () => {
    const failure = new Error("postgresql://private-user:private-password@private.invalid/db");
    mocks.raw.mockRejectedValue(failure);
    const operation = vi.fn();
    await expect(withAuthenticatedDatabase("private-user-id", operation)).rejects.toBe(failure);
    expect(operation).not.toHaveBeenCalled();
    expect(mocks.unsafe).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledOnce();
    expect(JSON.stringify(mocks.error.mock.calls)).not.toContain("private");
  });
});
