import {
  AutomationGeneration,
  AutomationGenerationPublisher,
  type AutomationGenerationSnapshot,
} from "../domain/automation-generation";
import type {
  GenerationCompilationInput,
  GenerationCompilationResult,
  GenerationCompiler,
  PublishedAutomationSpecificationSnapshot,
} from "../domain/automation-generator-domain-services";
import type { AutomationGeneratorDomainEvent } from "../domain/automation-generator-domain-events";
import {
  GenerationRuleStatus,
  GenerationRuleType,
  NodeType,
} from "../domain/automation-generator-enums";
import { generationResult, requestInput } from "../domain/automation-generator-test-fixtures";
import { GenerationRule, GenerationRuleCatalog } from "../domain/generation-rule-catalog";
import {
  CatalogVersion,
  ContentHash,
  CorrelationId,
  GenerationId,
  GenerationLineageId,
  GraphSchemaVersion,
  IdempotencyKey,
  LockVersion,
  TenantId,
} from "../domain/automation-generator-value-objects";
import type {
  ApplicationTransaction,
  AutomationGenerationApplicationResult,
  AutomationGenerationRepositoryPort,
  AutomationSpecificationReaderPort,
  ClockPort,
  ContentHasherPort,
  DeterministicIdFactory,
  DomainEventOutboxPort,
  GenerationRuleCatalogPort,
  IdempotencyRecord,
  IdempotencyScope,
  IdempotencyStorePort,
  TransactionPort,
} from "./automation-generator-application-ports";
import { IdempotentCommandExecutor } from "./idempotent-command-executor";

export const applicationIds = {
  idempotency: "018f22e2-7c10-7a11-8c11-012345678911",
  correlation: "018f22e2-7c10-7a11-8c11-012345678912",
};

export class FakeTransaction implements TransactionPort {
  opened = 0;
  committed = 0;
  rolledBack = 0;
  readonly context: ApplicationTransaction = { transactionId: "transaction-1" };

  async execute<TResult>(
    operation: (transaction: ApplicationTransaction) => Promise<TResult>,
  ): Promise<TResult> {
    this.opened += 1;
    try {
      const result = await operation(this.context);
      this.committed += 1;
      return result;
    } catch (error) {
      this.rolledBack += 1;
      throw error;
    }
  }
}

export class FakeRepository implements AutomationGenerationRepositoryPort {
  generation: AutomationGeneration | null = null;
  previous: AutomationGeneration | null = null;
  active: AutomationGeneration | null = null;
  saves: AutomationGeneration[] = [];
  calls: string[] = [];

  async findById(
    transaction: ApplicationTransaction,
    tenantId: TenantId,
    generationId: GenerationId,
  ): Promise<AutomationGeneration | null> {
    void transaction;
    void tenantId;
    void generationId;
    this.calls.push("findById");
    return this.generation;
  }

  async findLatestBySpecificationLineage(): Promise<AutomationGeneration | null> {
    this.calls.push("findLatestBySpecificationLineage");
    return this.previous;
  }

  async findActivePublishedByLineage(): Promise<AutomationGeneration | null> {
    this.calls.push("findActivePublishedByLineage");
    return this.active;
  }

  async save(
    _transaction: ApplicationTransaction,
    generation: AutomationGeneration,
  ): Promise<void> {
    this.calls.push("save");
    this.saves.push(generation);
    this.generation = generation;
  }
}

export class FakeSpecificationReader implements AutomationSpecificationReaderPort {
  calls = 0;
  snapshot: PublishedAutomationSpecificationSnapshot | null = publishedSpecification();

  async readPublishedSnapshot(): Promise<PublishedAutomationSpecificationSnapshot | null> {
    this.calls += 1;
    return this.snapshot;
  }
}

export class FakeRuleCatalogPort implements GenerationRuleCatalogPort {
  calls = 0;
  catalog: GenerationRuleCatalog | null = publishedCatalog();

  async getPublishedCompatibleCatalog(): Promise<GenerationRuleCatalog | null> {
    this.calls += 1;
    return this.catalog;
  }
}

export class FakeCompiler implements GenerationCompiler {
  calls: GenerationCompilationInput[] = [];
  error: Error | null = null;
  result: GenerationCompilationResult = generationResult();

  compile(input: GenerationCompilationInput): GenerationCompilationResult {
    this.calls.push(input);
    if (this.error) throw this.error;
    return this.result;
  }
}

export class FakeClock implements ClockPort {
  value = new Date("2026-01-01T00:10:00.000Z");

  now(): Date {
    return new Date(this.value);
  }
}

export class FakeIdFactory implements DeterministicIdFactory {
  generationIdCalls = 0;
  lineageIdCalls = 0;

  generationId(): GenerationId {
    this.generationIdCalls += 1;
    return requestInput().generationId;
  }

  generationLineageId(): GenerationLineageId {
    this.lineageIdCalls += 1;
    return requestInput().lineageId;
  }
}

export class FakeOutbox implements DomainEventOutboxPort {
  events: AutomationGeneratorDomainEvent[] = [];

  async append(
    _transaction: ApplicationTransaction,
    events: readonly AutomationGeneratorDomainEvent[],
  ): Promise<void> {
    this.events.push(...events);
  }
}

export class FakeHasher implements ContentHasherPort {
  value = ContentHash.create("c".repeat(64));
  calls = 0;

  fingerprint(): ContentHash {
    this.calls += 1;
    return this.value;
  }
}

export class FakeIdempotencyStore implements IdempotencyStorePort {
  record: IdempotencyRecord<AutomationGenerationApplicationResult> | null = null;
  reserves = 0;
  completions = 0;

  async find<TResult>(): Promise<IdempotencyRecord<TResult> | null> {
    return this.record as IdempotencyRecord<TResult> | null;
  }

  async reserve(
    _transaction: ApplicationTransaction,
    _scope: IdempotencyScope,
    fingerprint: ContentHash,
  ): Promise<void> {
    this.reserves += 1;
    this.record = { state: "IN_PROGRESS", fingerprint };
  }

  async complete<TResult>(
    _transaction: ApplicationTransaction,
    _scope: IdempotencyScope,
    fingerprint: ContentHash,
    result: TResult,
  ): Promise<void> {
    this.completions += 1;
    this.record = {
      state: "COMPLETED",
      fingerprint,
      result: result as AutomationGenerationApplicationResult,
    };
  }
}

export function dependencies() {
  const transaction = new FakeTransaction();
  const repository = new FakeRepository();
  const specificationReader = new FakeSpecificationReader();
  const ruleCatalog = new FakeRuleCatalogPort();
  const compiler = new FakeCompiler();
  const clock = new FakeClock();
  const idFactory = new FakeIdFactory();
  const outbox = new FakeOutbox();
  const hasher = new FakeHasher();
  const idempotencyStore = new FakeIdempotencyStore();
  const idempotency = new IdempotentCommandExecutor(idempotencyStore, hasher);
  return {
    transaction,
    repository,
    specificationReader,
    ruleCatalog,
    compiler,
    clock,
    idFactory,
    outbox,
    hasher,
    idempotencyStore,
    idempotency,
    publisher: new AutomationGenerationPublisher(),
  };
}

export function publishedSpecification(): PublishedAutomationSpecificationSnapshot {
  const input = requestInput();
  return {
    id: input.specification.id,
    tenantId: input.tenantId.value,
    lineageId: input.specification.lineageId,
    version: input.specification.version,
    status: "PUBLISHED",
    contentHash: input.specification.contentHash,
    elements: [],
  };
}

export function publishedCatalog(): GenerationRuleCatalog {
  return GenerationRuleCatalog.create({
    version: CatalogVersion.create("1.0.0"),
    status: GenerationRuleStatus.Published,
    rules: [
      GenerationRule.create({
        id: "rule-1",
        code: "project_action",
        version: 1,
        status: GenerationRuleStatus.Published,
        type: GenerationRuleType.Projection,
        priority: 1,
        active: true,
        capabilityCodes: ["cap.process"],
        targetNodeType: NodeType.Action,
        compatibleGraphSchemas: [GraphSchemaVersion.create("1.0.0")],
        parameters: {},
      }),
    ],
  });
}

export function commandContext() {
  return {
    tenantId: requestInput().tenantId,
    idempotencyKey: IdempotencyKey.create(applicationIds.idempotency),
    correlationId: CorrelationId.create(applicationIds.correlation),
  };
}

export function generatedGeneration(): AutomationGeneration {
  const generation = AutomationGeneration.request(requestInput());
  generation.generate(
    generationResult(),
    LockVersion.create(1),
    new Date("2026-01-01T00:01:00.000Z"),
  );
  return generation;
}

export function publishedGeneration(): AutomationGeneration {
  const generation = generatedGeneration();
  generation.publish(LockVersion.create(2), new Date("2026-01-01T00:02:00.000Z"));
  generation.pullDomainEvents();
  return generation;
}

export function completedRecord(
  result: Readonly<AutomationGenerationSnapshot>,
  fingerprint = ContentHash.create("c".repeat(64)),
): IdempotencyRecord<AutomationGenerationApplicationResult> {
  return { state: "COMPLETED", fingerprint, result };
}
