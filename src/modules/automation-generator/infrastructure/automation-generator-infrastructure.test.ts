import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { requestInput } from "../domain/automation-generator-test-fixtures";
import { AutomationGeneration } from "../domain/automation-generation";
import {
  ContentHash,
  IdempotencyKey,
  TenantId,
} from "../domain/automation-generator-value-objects";
import {
  DefaultGenerationCompiler,
  GenerationCompilationNotImplemented,
} from "./default-generation-compiler";
import { DomainEventPublisher } from "./domain-event-publisher";
import { PrismaAutomationGenerationRepository } from "./prisma-automation-generation-repository";
import { PrismaIdempotencyStore } from "./prisma-idempotency-store";
import { PrismaOutboxStore } from "./prisma-outbox-store";
import { PrismaTransactionManager, PrismaTransactionRegistry } from "./prisma-transaction-manager";
import { SystemClock, UuidFactory } from "./system-adapters";

const transaction = Object.freeze({ transactionId: "tx-1" });

describe("Automation Generator infrastructure", () => {
  it("commits one Prisma transaction and releases its scoped client", async () => {
    const registry = new PrismaTransactionRegistry();
    const client = {
      $executeRaw: vi.fn(),
      $executeRawUnsafe: vi.fn(),
    };
    const prisma = {
      $transaction: vi.fn(async (operation: (value: object) => Promise<string>) =>
        operation(client),
      ),
    };
    const manager = new PrismaTransactionManager(prisma as unknown as PrismaClient, registry, {
      userId: () => requestInput().tenantId.value,
    });

    await expect(
      manager.execute(async (scope) => {
        expect(registry.resolve(scope)).toBe(client);
        return "committed";
      }),
    ).resolves.toBe("committed");
    expect(() => registry.resolve(transaction)).toThrow("not active");
  });

  it("propagates failures so Prisma can roll back and releases the client", async () => {
    const registry = new PrismaTransactionRegistry();
    const client = {
      $executeRaw: vi.fn(),
      $executeRawUnsafe: vi.fn(),
    };
    const prisma = {
      $transaction: async (operation: (value: object) => Promise<never>) => operation(client),
    };
    const manager = new PrismaTransactionManager(prisma as unknown as PrismaClient, registry, {
      userId: () => requestInput().tenantId.value,
    });
    let usedTransactionId = "";

    await expect(
      manager.execute(async (scope) => {
        usedTransactionId = scope.transactionId;
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(() => registry.resolve({ transactionId: usedTransactionId })).toThrow("not active");
  });

  it("creates stable tenant-scoped generation and lineage identifiers", () => {
    const factory = new UuidFactory();
    const input = requestInput();
    const idempotencyKey = IdempotencyKey.create("018f83e1-b801-7911-957b-10c818f97584");

    const first = factory.generationId({
      tenantId: input.tenantId,
      specificationSnapshotId: input.specification.id,
      idempotencyKey,
    });
    const second = factory.generationId({
      tenantId: input.tenantId,
      specificationSnapshotId: input.specification.id,
      idempotencyKey,
    });

    expect(first.equals(second)).toBe(true);
    expect(
      factory.generationLineageId({
        tenantId: input.tenantId,
        specificationLineageId: input.specification.lineageId,
      }).value,
    ).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("uses the system clock without retaining mutable Date instances", () => {
    const before = Date.now();
    const value = new SystemClock().now();
    expect(value.getTime()).toBeGreaterThanOrEqual(before);
    expect(value).not.toBe(new SystemClock().now());
  });

  it("keeps compilation explicitly unavailable until AG-2B", () => {
    expect(() => new DefaultGenerationCompiler().compile({} as never)).toThrow(
      GenerationCompilationNotImplemented,
    );
  });

  it("stores domain events through the outbox adapter only", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const registry = registryWith({ automationGenerationOutboxRecord: { createMany } });
    const outbox = new PrismaOutboxStore(registry);
    const publisher = new DomainEventPublisher(outbox);
    const event = Object.freeze({
      eventName: "AutomationGenerationDeprecated" as const,
      tenantId: requestInput().tenantId.value,
      generationId: requestInput().generationId.value,
      lineageId: requestInput().lineageId.value,
      generationVersion: 1,
      occurredAt: new Date().toISOString(),
    });

    await publisher.append(transaction, [event]);

    expect(createMany).toHaveBeenCalledOnce();
    expect(createMany.mock.calls[0]?.[0].data[0].eventName).toBe(event.eventName);
  });

  it("reserves, completes, replays, and detects conflicting idempotency keys", async () => {
    let row: Record<string, unknown> | null = null;
    const delegate = {
      findUnique: vi.fn(async () => row),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        row = { ...data, resultJson: null };
      }),
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        row = { ...row, ...data };
        return { count: 1 };
      }),
    };
    const store = new PrismaIdempotencyStore(
      registryWith({ automationGenerationIdempotencyRecord: delegate }),
    );
    const scope = {
      tenantId: requestInput().tenantId.value,
      commandName: "RequestAutomationGeneration",
      key: "018f83e1-b801-7911-957b-10c818f97584",
    };
    const fingerprint = ContentHash.create("a".repeat(64));

    await store.reserve(transaction, scope, fingerprint);
    expect((await store.replay(transaction, scope))?.state).toBe("IN_PROGRESS");
    await store.complete(transaction, scope, fingerprint, { id: "result" });
    expect(await store.replay(transaction, scope)).toMatchObject({
      state: "COMPLETED",
      result: { id: "result" },
    });
    expect(await store.conflict(transaction, scope, ContentHash.create("b".repeat(64)))).toBe(true);
  });

  it("persists and rehydrates requested generations with tenant filters", async () => {
    let record: Record<string, unknown> | null = null;
    const delegate = {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        record = data;
        return data;
      }),
      findFirst: vi.fn(async () => record),
      updateMany: vi.fn(),
    };
    const repository = new PrismaAutomationGenerationRepository(
      registryWith({ automationGenerationRecord: delegate }),
    );
    const generation = AutomationGeneration.request(requestInput());

    await repository.save(transaction, generation);
    const loaded = await repository.findById(
      transaction,
      requestInput().tenantId,
      requestInput().generationId,
    );

    expect(loaded?.snapshot().generationId.value).toBe(requestInput().generationId.value);
    expect(delegate.findFirst).toHaveBeenCalledWith({
      where: {
        id: requestInput().generationId.value,
        organizationId: requestInput().tenantId.value,
      },
    });
  });

  it("never resolves records from a different tenant", async () => {
    const delegate = { findFirst: vi.fn().mockResolvedValue(null) };
    const repository = new PrismaAutomationGenerationRepository(
      registryWith({ automationGenerationRecord: delegate }),
    );
    const otherTenant = TenantId.create("00000000-0000-4000-8000-000000000099");

    await expect(
      repository.findById(transaction, otherTenant, requestInput().generationId),
    ).resolves.toBeNull();
    expect(delegate.findFirst.mock.calls[0]?.[0].where.organizationId).toBe(otherTenant.value);
  });
});

function registryWith(client: object): PrismaTransactionRegistry {
  const registry = new PrismaTransactionRegistry();
  registry.register(
    transaction.transactionId,
    client as Parameters<PrismaTransactionRegistry["register"]>[1],
  );
  return registry;
}
