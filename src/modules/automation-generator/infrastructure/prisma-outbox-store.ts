import type { Prisma } from "@/generated/prisma/client";
import type { ApplicationTransaction } from "../application/automation-generator-application-ports";
import type { AutomationGeneratorDomainEvent } from "../domain/automation-generator-domain-events";
import { PrismaTransactionRegistry } from "./prisma-transaction-manager";

export interface PendingOutboxMessage {
  readonly id: string;
  readonly organizationId: string;
  readonly aggregateId: string;
  readonly eventName: string;
  readonly payload: unknown;
  readonly occurredAt: Date;
}

export class PrismaOutboxStore {
  constructor(private readonly transactions: PrismaTransactionRegistry) {}

  async save(
    transaction: ApplicationTransaction,
    events: readonly AutomationGeneratorDomainEvent[],
  ): Promise<void> {
    if (events.length === 0) return;
    const client = this.transactions.resolve(transaction);
    await client.automationGenerationOutboxRecord.createMany({
      data: events.map((event) => ({
        organizationId: event.tenantId,
        aggregateId: event.generationId,
        eventName: event.eventName,
        payloadJson: JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue,
        occurredAt: new Date(event.occurredAt),
      })),
    });
  }

  async readPending(
    transaction: ApplicationTransaction,
    limit = 100,
  ): Promise<readonly PendingOutboxMessage[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000)
      throw new Error("Outbox read limit must be between 1 and 1000");
    const records = await this.transactions
      .resolve(transaction)
      .automationGenerationOutboxRecord.findMany({
        where: { publishedAt: null },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: limit,
      });
    return records.map((record) =>
      Object.freeze({
        id: record.id,
        organizationId: record.organizationId,
        aggregateId: record.aggregateId,
        eventName: record.eventName,
        payload: record.payloadJson,
        occurredAt: record.occurredAt,
      }),
    );
  }

  async markPublished(
    transaction: ApplicationTransaction,
    messageId: string,
    publishedAt: Date,
  ): Promise<void> {
    await this.transactions.resolve(transaction).automationGenerationOutboxRecord.updateMany({
      where: { id: messageId, publishedAt: null },
      data: { publishedAt },
    });
  }
}
