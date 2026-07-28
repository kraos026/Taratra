import type { Prisma } from "@/generated/prisma/client";
import type {
  ApplicationTransaction,
  IdempotencyRecord,
  IdempotencyScope,
  IdempotencyStorePort,
} from "../application/automation-generator-application-ports";
import type { ContentHash } from "../domain/automation-generator-value-objects";
import { ContentHash as ContentHashValue } from "../domain/automation-generator-value-objects";
import { PrismaTransactionRegistry } from "./prisma-transaction-manager";

export class PrismaIdempotencyStore implements IdempotencyStorePort {
  constructor(private readonly transactions: PrismaTransactionRegistry) {}

  async find<TResult>(
    transaction: ApplicationTransaction,
    scope: IdempotencyScope,
  ): Promise<IdempotencyRecord<TResult> | null> {
    const record = await this.transactions
      .resolve(transaction)
      .automationGenerationIdempotencyRecord.findUnique({
        where: {
          organizationId_commandName_idempotencyKey: {
            organizationId: scope.tenantId,
            commandName: scope.commandName,
            idempotencyKey: scope.key,
          },
        },
      });
    if (!record) return null;
    const fingerprint = ContentHashValue.create(record.fingerprint);
    if (record.state === "IN_PROGRESS") return Object.freeze({ state: "IN_PROGRESS", fingerprint });
    if (record.state !== "COMPLETED" || record.resultJson === null)
      throw new Error("Persisted idempotency record is invalid");
    return Object.freeze({
      state: "COMPLETED",
      fingerprint,
      result: structuredClone(record.resultJson) as TResult,
    });
  }

  async reserve(
    transaction: ApplicationTransaction,
    scope: IdempotencyScope,
    fingerprint: ContentHash,
  ): Promise<void> {
    await this.transactions.resolve(transaction).automationGenerationIdempotencyRecord.create({
      data: {
        organizationId: scope.tenantId,
        commandName: scope.commandName,
        idempotencyKey: scope.key,
        fingerprint: fingerprint.value,
        state: "IN_PROGRESS",
      },
    });
  }

  async complete<TResult>(
    transaction: ApplicationTransaction,
    scope: IdempotencyScope,
    fingerprint: ContentHash,
    result: TResult,
  ): Promise<void> {
    const update = await this.transactions
      .resolve(transaction)
      .automationGenerationIdempotencyRecord.updateMany({
        where: {
          organizationId: scope.tenantId,
          commandName: scope.commandName,
          idempotencyKey: scope.key,
          fingerprint: fingerprint.value,
          state: "IN_PROGRESS",
        },
        data: {
          state: "COMPLETED",
          resultJson: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
    if (update.count !== 1) throw new Error("Idempotency reservation was not found");
  }

  replay<TResult>(
    transaction: ApplicationTransaction,
    scope: IdempotencyScope,
  ): Promise<IdempotencyRecord<TResult> | null> {
    return this.find<TResult>(transaction, scope);
  }

  async conflict(
    transaction: ApplicationTransaction,
    scope: IdempotencyScope,
    fingerprint: ContentHash,
  ): Promise<boolean> {
    const record = await this.find(transaction, scope);
    return record !== null && !record.fingerprint.equals(fingerprint);
  }
}
