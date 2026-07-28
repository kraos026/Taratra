import {
  ContentHash,
  GenerationId,
  GenerationLineageId,
  GenerationVersion,
  TenantId,
} from "./automation-generator-value-objects";

export interface AutomationGeneratorDomainEvent {
  readonly eventName: "AutomationGraphPublished" | "AutomationGenerationDeprecated";
  readonly tenantId: string;
  readonly generationId: string;
  readonly lineageId: string;
  readonly generationVersion: number;
  readonly occurredAt: string;
}

export class AutomationGraphPublished implements AutomationGeneratorDomainEvent {
  readonly eventName = "AutomationGraphPublished";

  constructor(
    tenantId: TenantId,
    generationId: GenerationId,
    lineageId: GenerationLineageId,
    generationVersion: GenerationVersion,
    readonly contentHash: ContentHash,
    readonly occurredAt: string,
  ) {
    this.tenantId = tenantId.value;
    this.generationId = generationId.value;
    this.lineageId = lineageId.value;
    this.generationVersion = generationVersion.value;
    Object.freeze(this);
  }

  readonly tenantId: string;
  readonly generationId: string;
  readonly lineageId: string;
  readonly generationVersion: number;
}

export class AutomationGenerationDeprecated implements AutomationGeneratorDomainEvent {
  readonly eventName = "AutomationGenerationDeprecated";

  constructor(
    tenantId: TenantId,
    generationId: GenerationId,
    lineageId: GenerationLineageId,
    generationVersion: GenerationVersion,
    readonly occurredAt: string,
  ) {
    this.tenantId = tenantId.value;
    this.generationId = generationId.value;
    this.lineageId = lineageId.value;
    this.generationVersion = generationVersion.value;
    Object.freeze(this);
  }

  readonly tenantId: string;
  readonly generationId: string;
  readonly lineageId: string;
  readonly generationVersion: number;
}
