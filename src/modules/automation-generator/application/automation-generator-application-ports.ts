import type {
  AutomationGeneration,
  AutomationGenerationSnapshot,
} from "../domain/automation-generation";
import type { AutomationGeneratorDomainEvent } from "../domain/automation-generator-domain-events";
import type { PublishedAutomationSpecificationSnapshot } from "../domain/automation-generator-domain-services";
import type { GenerationRuleCatalog } from "../domain/generation-rule-catalog";
import type {
  CatalogVersion,
  ContentHash,
  GenerationId,
  GenerationLineageId,
  GraphSchemaVersion,
  IdempotencyKey,
  TenantId,
} from "../domain/automation-generator-value-objects";

export interface ApplicationTransaction {
  readonly transactionId: string;
}

export interface TransactionPort {
  execute<TResult>(
    operation: (transaction: ApplicationTransaction) => Promise<TResult>,
  ): Promise<TResult>;
}

export interface AutomationGenerationRepositoryPort {
  findById(
    transaction: ApplicationTransaction,
    tenantId: TenantId,
    generationId: GenerationId,
  ): Promise<AutomationGeneration | null>;

  findLatestBySpecificationLineage(
    transaction: ApplicationTransaction,
    tenantId: TenantId,
    specificationLineageId: string,
  ): Promise<AutomationGeneration | null>;

  findActivePublishedByLineage(
    transaction: ApplicationTransaction,
    tenantId: TenantId,
    lineageId: GenerationLineageId,
    excludingGenerationId: GenerationId,
  ): Promise<AutomationGeneration | null>;

  save(transaction: ApplicationTransaction, generation: AutomationGeneration): Promise<void>;
}

export interface AutomationSpecificationReaderPort {
  readPublishedSnapshot(
    transaction: ApplicationTransaction,
    tenantId: TenantId,
    snapshotId: string,
  ): Promise<PublishedAutomationSpecificationSnapshot | null>;
}

export interface GenerationRuleCatalogPort {
  getPublishedCompatibleCatalog(
    transaction: ApplicationTransaction,
    tenantId: TenantId,
    version: CatalogVersion,
    graphSchemaVersion: GraphSchemaVersion,
  ): Promise<GenerationRuleCatalog | null>;
}

export interface ClockPort {
  now(): Date;
}

export interface ContentHasherPort {
  fingerprint(commandName: string, command: object): ContentHash;
}

export interface DeterministicIdFactory {
  generationId(input: {
    tenantId: TenantId;
    specificationSnapshotId: string;
    idempotencyKey: IdempotencyKey;
  }): GenerationId;

  generationLineageId(input: {
    tenantId: TenantId;
    specificationLineageId: string;
  }): GenerationLineageId;
}

export interface DomainEventOutboxPort {
  append(
    transaction: ApplicationTransaction,
    events: readonly AutomationGeneratorDomainEvent[],
  ): Promise<void>;
}

export interface IdempotencyScope {
  readonly tenantId: string;
  readonly commandName: string;
  readonly key: string;
}

export type IdempotencyRecord<TResult> =
  | {
      readonly state: "IN_PROGRESS";
      readonly fingerprint: ContentHash;
    }
  | {
      readonly state: "COMPLETED";
      readonly fingerprint: ContentHash;
      readonly result: TResult;
    };

export interface IdempotencyStorePort {
  find<TResult>(
    transaction: ApplicationTransaction,
    scope: IdempotencyScope,
  ): Promise<IdempotencyRecord<TResult> | null>;

  reserve(
    transaction: ApplicationTransaction,
    scope: IdempotencyScope,
    fingerprint: ContentHash,
  ): Promise<void>;

  complete<TResult>(
    transaction: ApplicationTransaction,
    scope: IdempotencyScope,
    fingerprint: ContentHash,
    result: TResult,
  ): Promise<void>;
}

export type AutomationGenerationApplicationResult = Readonly<AutomationGenerationSnapshot>;
