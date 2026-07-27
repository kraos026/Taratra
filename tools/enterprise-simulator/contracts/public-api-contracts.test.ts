import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ENTERPRISE_SIMULATOR_ENDPOINTS,
  ENTERPRISE_SIMULATOR_HEADERS,
  IDEMPOTENCY_MINIMUM_RETENTION_HOURS,
  SYNTHETIC_CLEANUP_PERMISSION,
  SYNTHETIC_IDENTITY_MAXIMUM_LIFETIME_HOURS,
  SYNTHETIC_TENANT_CLASSIFICATION,
} from "./public-api-contracts";

describe("Enterprise Simulator public contracts", () => {
  it("defines the read-only latest ready Knowledge endpoint", () => {
    expect(ENTERPRISE_SIMULATOR_ENDPOINTS.latestReadyKnowledgeSnapshot("company")).toBe(
      "/api/companies/company/knowledge-snapshots/latest?status=ready",
    );
  });

  it("uses dedicated simulation-run routes rather than a generic tenant deletion route", () => {
    expect(ENTERPRISE_SIMULATOR_ENDPOINTS.cleanupSyntheticTenant("run")).toBe(
      "/api/test-support/simulation-runs/run/tenant",
    );
    expect(ENTERPRISE_SIMULATOR_ENDPOINTS.cleanupSyntheticTenant("run")).not.toBe(
      "/api/organizations/run",
    );
  });

  it("requires an explicit synthetic marker and dedicated cleanup permission", () => {
    expect(SYNTHETIC_TENANT_CLASSIFICATION).toBe("SYNTHETIC_TEST");
    expect(SYNTHETIC_CLEANUP_PERMISSION).toBe("synthetic_test:cleanup");
  });

  it("defines bounded identity lifetime and durable idempotency retention", () => {
    expect(SYNTHETIC_IDENTITY_MAXIMUM_LIFETIME_HOURS).toBe(24);
    expect(IDEMPOTENCY_MINIMUM_RETENTION_HOURS).toBe(48);
  });

  it("defines canonical idempotency and correlation headers", () => {
    expect(ENTERPRISE_SIMULATOR_HEADERS).toEqual({
      correlationId: "X-Correlation-ID",
      idempotencyKey: "Idempotency-Key",
      idempotencyReplayed: "Idempotency-Replayed",
    });
  });

  it("contains no direct Prisma, PostgreSQL or internal AutomateX module dependency", () => {
    const directory = join(process.cwd(), "tools/enterprise-simulator/contracts");
    const source = ["interfaces.ts", "public-api-contracts.ts"]
      .map((file) => readFileSync(join(directory, file), "utf8"))
      .join("\n");
    expect(source).not.toMatch(/@prisma|PrismaClient|postgresql:|src\/modules|src\/infrastructure/);
  });
});
