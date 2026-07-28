import {
  CatalogVersion,
  CorrelationId,
  GenerationId,
  GeneratorVersion,
  GraphSchemaVersion,
  IdempotencyKey,
  LockVersion,
  TenantId,
} from "../domain/automation-generator-value-objects";

abstract class AutomationGeneratorCommand {
  protected constructor(
    readonly tenantId: TenantId,
    readonly idempotencyKey: IdempotencyKey,
    readonly correlationId: CorrelationId,
  ) {}
}

export class RequestAutomationGenerationCommand extends AutomationGeneratorCommand {
  constructor(
    tenantId: TenantId,
    idempotencyKey: IdempotencyKey,
    correlationId: CorrelationId,
    readonly automationSpecificationSnapshotId: string,
    readonly generatorVersion: GeneratorVersion,
    readonly graphSchemaVersion: GraphSchemaVersion,
    readonly ruleCatalogVersion: CatalogVersion,
  ) {
    super(tenantId, idempotencyKey, correlationId);
    Object.freeze(this);
  }
}

abstract class ExistingGenerationCommand extends AutomationGeneratorCommand {
  protected constructor(
    tenantId: TenantId,
    idempotencyKey: IdempotencyKey,
    correlationId: CorrelationId,
    readonly generationId: GenerationId,
    readonly expectedVersion: LockVersion,
  ) {
    super(tenantId, idempotencyKey, correlationId);
  }
}

export class GenerateAutomationGraphCommand extends ExistingGenerationCommand {
  constructor(
    tenantId: TenantId,
    idempotencyKey: IdempotencyKey,
    correlationId: CorrelationId,
    generationId: GenerationId,
    expectedVersion: LockVersion,
  ) {
    super(tenantId, idempotencyKey, correlationId, generationId, expectedVersion);
    Object.freeze(this);
  }
}

export class RebuildAutomationGenerationCommand extends ExistingGenerationCommand {
  constructor(
    tenantId: TenantId,
    idempotencyKey: IdempotencyKey,
    correlationId: CorrelationId,
    generationId: GenerationId,
    expectedVersion: LockVersion,
  ) {
    super(tenantId, idempotencyKey, correlationId, generationId, expectedVersion);
    Object.freeze(this);
  }
}

export class PublishAutomationGenerationCommand extends ExistingGenerationCommand {
  constructor(
    tenantId: TenantId,
    idempotencyKey: IdempotencyKey,
    correlationId: CorrelationId,
    generationId: GenerationId,
    expectedVersion: LockVersion,
  ) {
    super(tenantId, idempotencyKey, correlationId, generationId, expectedVersion);
    Object.freeze(this);
  }
}

export class DeprecateAutomationGenerationCommand extends ExistingGenerationCommand {
  constructor(
    tenantId: TenantId,
    idempotencyKey: IdempotencyKey,
    correlationId: CorrelationId,
    generationId: GenerationId,
    expectedVersion: LockVersion,
  ) {
    super(tenantId, idempotencyKey, correlationId, generationId, expectedVersion);
    Object.freeze(this);
  }
}

export type MutatingAutomationGeneratorCommand =
  | RequestAutomationGenerationCommand
  | GenerateAutomationGraphCommand
  | RebuildAutomationGenerationCommand
  | PublishAutomationGenerationCommand
  | DeprecateAutomationGenerationCommand;
