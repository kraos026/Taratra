import { describe, expect, it } from "vitest";
import { deepmerge } from "deepmerge-ts";

describe("scoped Prisma config merge override", () => {
  it("preserves the plain configuration and array merge contract used by Prisma", () => {
    const left = {
      schema: "prisma/schema.prisma",
      tables: { external: ["auth.users"] },
      experimental: { externalTables: true },
    };
    const right = {
      tables: { external: ["auth.sessions"] },
      experimental: { externalEnums: true },
    };
    expect(deepmerge(left, right)).toEqual({
      schema: "prisma/schema.prisma",
      tables: { external: ["auth.users", "auth.sessions"] },
      experimental: { externalTables: true, externalEnums: true },
    });
    expect(left.tables.external).toEqual(["auth.users"]);
  });
  it("handles recursive object inputs without stack exhaustion", () => {
    const left: { self?: unknown } = {};
    const right: { self?: unknown } = {};
    left.self = left;
    right.self = right;
    expect(() => deepmerge(left, right)).not.toThrow();
  });
});
