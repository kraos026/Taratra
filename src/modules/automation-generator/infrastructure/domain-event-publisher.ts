import type {
  ApplicationTransaction,
  DomainEventOutboxPort,
} from "../application/automation-generator-application-ports";
import type { AutomationGeneratorDomainEvent } from "../domain/automation-generator-domain-events";
import { PrismaOutboxStore } from "./prisma-outbox-store";

export class DomainEventPublisher implements DomainEventOutboxPort {
  constructor(private readonly outbox: PrismaOutboxStore) {}

  append(
    transaction: ApplicationTransaction,
    events: readonly AutomationGeneratorDomainEvent[],
  ): Promise<void> {
    return this.outbox.save(transaction, events);
  }
}
