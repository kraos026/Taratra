import {
  AutomationGeneration,
  AutomationGenerationPublisher,
  type AutomationGenerationSnapshot,
} from "../domain/automation-generation";
import type {
  GenerationCompiler,
  PublishedAutomationSpecificationSnapshot,
} from "../domain/automation-generator-domain-services";
import { CrossTenantAccessDenied } from "../domain/automation-generator-errors";
import { GenerationVersion, TenantId } from "../domain/automation-generator-value-objects";
import {
  AutomationGenerationNotFound,
  PublishedGenerationRuleCatalogNotFound,
  PublishedSpecificationNotFound,
} from "./automation-generator-application-errors";
import type {
  ApplicationTransaction,
  AutomationGenerationApplicationResult,
  AutomationGenerationRepositoryPort,
  AutomationSpecificationReaderPort,
  ClockPort,
  DeterministicIdFactory,
  DomainEventOutboxPort,
  GenerationRuleCatalogPort,
  TransactionPort,
} from "./automation-generator-application-ports";
import {
  DeprecateAutomationGenerationCommand,
  GenerateAutomationGraphCommand,
  PublishAutomationGenerationCommand,
  RebuildAutomationGenerationCommand,
  RequestAutomationGenerationCommand,
} from "./automation-generator-commands";
import { IdempotentCommandExecutor } from "./idempotent-command-executor";

interface CommandUseCaseDependencies {
  readonly transaction: TransactionPort;
  readonly repository: AutomationGenerationRepositoryPort;
  readonly idempotency: IdempotentCommandExecutor;
}

interface CompilationUseCaseDependencies extends CommandUseCaseDependencies {
  readonly specificationReader: AutomationSpecificationReaderPort;
  readonly ruleCatalog: GenerationRuleCatalogPort;
  readonly compiler: GenerationCompiler;
  readonly clock: ClockPort;
}

export class RequestAutomationGeneration {
  constructor(
    private readonly dependencies: CommandUseCaseDependencies & {
      readonly specificationReader: AutomationSpecificationReaderPort;
      readonly idFactory: DeterministicIdFactory;
      readonly clock: ClockPort;
    },
  ) {}

  execute(
    command: RequestAutomationGenerationCommand,
  ): Promise<AutomationGenerationApplicationResult> {
    return this.dependencies.transaction.execute((transaction) =>
      this.dependencies.idempotency.execute(
        transaction,
        "RequestAutomationGeneration",
        command,
        async () => {
          const specification = await requiredPublishedSpecification(
            this.dependencies.specificationReader,
            transaction,
            command.tenantId,
            command.automationSpecificationSnapshotId,
          );
          const previous = await this.dependencies.repository.findLatestBySpecificationLineage(
            transaction,
            command.tenantId,
            specification.lineageId,
          );
          const previousSnapshot = previous?.snapshot();
          const lineageId =
            previousSnapshot?.lineageId ??
            this.dependencies.idFactory.generationLineageId({
              tenantId: command.tenantId,
              specificationLineageId: specification.lineageId,
            });
          const generationVersion = previousSnapshot
            ? previousSnapshot.generationVersion.next()
            : GenerationVersion.create(1);
          const generation = AutomationGeneration.request({
            tenantId: command.tenantId,
            generationId: this.dependencies.idFactory.generationId({
              tenantId: command.tenantId,
              specificationSnapshotId: specification.id,
              idempotencyKey: command.idempotencyKey,
            }),
            lineageId,
            generationVersion,
            specification: specificationReference(specification),
            generatorVersion: command.generatorVersion,
            graphSchemaVersion: command.graphSchemaVersion,
            ruleCatalogVersion: command.ruleCatalogVersion,
            createdAt: this.dependencies.clock.now(),
            ...(previousSnapshot
              ? {
                  previousGeneration: {
                    tenantId: previousSnapshot.tenantId,
                    lineageId: previousSnapshot.lineageId,
                    specificationLineageId: previousSnapshot.specification.lineageId,
                    generationVersion: previousSnapshot.generationVersion,
                    specificationVersion: previousSnapshot.specification.version,
                  },
                }
              : {}),
          });
          await this.dependencies.repository.save(transaction, generation);
          return generation.snapshot();
        },
      ),
    );
  }
}

export class GenerateAutomationGraph {
  constructor(private readonly dependencies: CompilationUseCaseDependencies) {}

  execute(command: GenerateAutomationGraphCommand): Promise<AutomationGenerationApplicationResult> {
    return executeCompilationCommand(
      this.dependencies,
      command,
      "GenerateAutomationGraph",
      "generate",
    );
  }
}

export class RebuildAutomationGeneration {
  constructor(private readonly dependencies: CompilationUseCaseDependencies) {}

  execute(
    command: RebuildAutomationGenerationCommand,
  ): Promise<AutomationGenerationApplicationResult> {
    return executeCompilationCommand(
      this.dependencies,
      command,
      "RebuildAutomationGeneration",
      "rebuild",
    );
  }
}

export class PublishAutomationGeneration {
  constructor(
    private readonly dependencies: CommandUseCaseDependencies & {
      readonly clock: ClockPort;
      readonly outbox: DomainEventOutboxPort;
      readonly publisher: AutomationGenerationPublisher;
    },
  ) {}

  execute(
    command: PublishAutomationGenerationCommand,
  ): Promise<AutomationGenerationApplicationResult> {
    return this.dependencies.transaction.execute((transaction) =>
      this.dependencies.idempotency.execute(
        transaction,
        "PublishAutomationGeneration",
        command,
        async () => {
          const candidate = await requiredGeneration(
            this.dependencies.repository,
            transaction,
            command.tenantId,
            command.generationId,
          );
          const candidateSnapshot = candidate.snapshot();
          const previousActive = await this.dependencies.repository.findActivePublishedByLineage(
            transaction,
            command.tenantId,
            candidateSnapshot.lineageId,
            candidateSnapshot.generationId,
          );
          const occurredAt = this.dependencies.clock.now();
          this.dependencies.publisher.publish({
            candidate,
            candidateExpectedVersion: command.expectedVersion,
            ...(previousActive
              ? {
                  previousActive,
                  previousExpectedVersion: previousActive.snapshot().lockVersion,
                }
              : {}),
            occurredAt,
          });
          if (previousActive) await this.dependencies.repository.save(transaction, previousActive);
          await this.dependencies.repository.save(transaction, candidate);
          await this.dependencies.outbox.append(transaction, [
            ...(previousActive?.pullDomainEvents() ?? []),
            ...candidate.pullDomainEvents(),
          ]);
          return candidate.snapshot();
        },
      ),
    );
  }
}

export class DeprecateAutomationGeneration {
  constructor(
    private readonly dependencies: CommandUseCaseDependencies & {
      readonly clock: ClockPort;
      readonly outbox: DomainEventOutboxPort;
    },
  ) {}

  execute(
    command: DeprecateAutomationGenerationCommand,
  ): Promise<AutomationGenerationApplicationResult> {
    return this.dependencies.transaction.execute((transaction) =>
      this.dependencies.idempotency.execute(
        transaction,
        "DeprecateAutomationGeneration",
        command,
        async () => {
          const generation = await requiredGeneration(
            this.dependencies.repository,
            transaction,
            command.tenantId,
            command.generationId,
          );
          generation.deprecate(command.expectedVersion, this.dependencies.clock.now());
          await this.dependencies.repository.save(transaction, generation);
          await this.dependencies.outbox.append(transaction, generation.pullDomainEvents());
          return generation.snapshot();
        },
      ),
    );
  }
}

async function executeCompilationCommand(
  dependencies: CompilationUseCaseDependencies,
  command: GenerateAutomationGraphCommand | RebuildAutomationGenerationCommand,
  commandName: "GenerateAutomationGraph" | "RebuildAutomationGeneration",
  operation: "generate" | "rebuild",
): Promise<AutomationGenerationApplicationResult> {
  return dependencies.transaction.execute((transaction) =>
    dependencies.idempotency.execute(transaction, commandName, command, async () => {
      const generation = await requiredGeneration(
        dependencies.repository,
        transaction,
        command.tenantId,
        command.generationId,
      );
      const snapshot = generation.snapshot();
      const specification = await requiredPublishedSpecification(
        dependencies.specificationReader,
        transaction,
        command.tenantId,
        snapshot.specification.id,
      );
      const catalog = await dependencies.ruleCatalog.getPublishedCompatibleCatalog(
        transaction,
        command.tenantId,
        snapshot.ruleCatalogVersion,
        snapshot.graphSchemaVersion,
      );
      if (!catalog) throw new PublishedGenerationRuleCatalogNotFound();
      const result = dependencies.compiler.compile({
        specification,
        catalog,
        graphSchemaVersion: snapshot.graphSchemaVersion,
      });
      if (operation === "generate")
        generation.generate(result, command.expectedVersion, dependencies.clock.now());
      else generation.rebuild(result, command.expectedVersion, dependencies.clock.now());
      await dependencies.repository.save(transaction, generation);
      return generation.snapshot();
    }),
  );
}

async function requiredGeneration(
  repository: AutomationGenerationRepositoryPort,
  transaction: ApplicationTransaction,
  tenantId: TenantId,
  generationId: Parameters<AutomationGenerationRepositoryPort["findById"]>[2],
): Promise<AutomationGeneration> {
  const generation = await repository.findById(transaction, tenantId, generationId);
  if (!generation) throw new AutomationGenerationNotFound();
  return generation;
}

async function requiredPublishedSpecification(
  reader: AutomationSpecificationReaderPort,
  transaction: ApplicationTransaction,
  tenantId: TenantId,
  snapshotId: string,
): Promise<PublishedAutomationSpecificationSnapshot> {
  const specification = await reader.readPublishedSnapshot(transaction, tenantId, snapshotId);
  if (!specification) throw new PublishedSpecificationNotFound();
  if (!tenantId.equals(TenantId.create(specification.tenantId)))
    throw new CrossTenantAccessDenied();
  return specification;
}

function specificationReference(
  specification: PublishedAutomationSpecificationSnapshot,
): AutomationGenerationSnapshot["specification"] {
  return {
    id: specification.id,
    tenantId: TenantId.create(specification.tenantId),
    lineageId: specification.lineageId,
    version: specification.version,
    status: "PUBLISHED",
    contentHash: specification.contentHash,
  };
}
