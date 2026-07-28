import type { PrismaClient } from "@/generated/prisma/client";
import type {
  ContentHasherPort,
  GenerationRuleCatalogPort,
} from "../application/automation-generator-application-ports";
import { DefaultGenerationCompiler } from "../infrastructure/default-generation-compiler";
import { DomainEventPublisher } from "../infrastructure/domain-event-publisher";
import { GenerationSpecificationReader } from "../infrastructure/generation-specification-reader";
import { PrismaAutomationGenerationRepository } from "../infrastructure/prisma-automation-generation-repository";
import { PrismaIdempotencyStore } from "../infrastructure/prisma-idempotency-store";
import { PrismaOutboxStore } from "../infrastructure/prisma-outbox-store";
import {
  type AuthenticatedDatabaseContext,
  PrismaTransactionManager,
  PrismaTransactionRegistry,
} from "../infrastructure/prisma-transaction-manager";
import { SystemClock, UuidFactory } from "../infrastructure/system-adapters";
import {
  assertCompleteProviders,
  type AutomationGeneratorProviders,
} from "./automation-generator-providers";

export interface AutomationGeneratorInfrastructureDependencies {
  readonly prisma: PrismaClient;
  readonly securityContext: AuthenticatedDatabaseContext;
  readonly ruleCatalog: GenerationRuleCatalogPort;
  readonly contentHasher: ContentHasherPort;
}

export interface AutomationGeneratorInfrastructureProviders extends AutomationGeneratorProviders {
  readonly outboxStore: PrismaOutboxStore;
}

export class AutomationGeneratorInfrastructureModule {
  static create(
    dependencies: AutomationGeneratorInfrastructureDependencies,
  ): AutomationGeneratorInfrastructureProviders {
    const transactions = new PrismaTransactionRegistry();
    const outboxStore = new PrismaOutboxStore(transactions);
    const providers = assertCompleteProviders({
      repository: new PrismaAutomationGenerationRepository(transactions),
      transaction: new PrismaTransactionManager(
        dependencies.prisma,
        transactions,
        dependencies.securityContext,
      ),
      clock: new SystemClock(),
      idFactory: new UuidFactory(),
      outbox: new DomainEventPublisher(outboxStore),
      compiler: new DefaultGenerationCompiler(),
      specificationReader: new GenerationSpecificationReader(transactions),
      idempotencyStore: new PrismaIdempotencyStore(transactions),
      ruleCatalog: dependencies.ruleCatalog,
      contentHasher: dependencies.contentHasher,
    });
    return Object.freeze({ ...providers, outboxStore });
  }
}
