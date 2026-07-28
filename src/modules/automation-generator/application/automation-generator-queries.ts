import { GenerationId, TenantId } from "../domain/automation-generator-value-objects";

abstract class AutomationGenerationQuery {
  protected constructor(
    readonly tenantId: TenantId,
    readonly generationId: GenerationId,
  ) {}
}

export class GetAutomationGenerationQuery extends AutomationGenerationQuery {
  constructor(tenantId: TenantId, generationId: GenerationId) {
    super(tenantId, generationId);
    Object.freeze(this);
  }
}

export class GetAutomationGraphQuery extends AutomationGenerationQuery {
  constructor(tenantId: TenantId, generationId: GenerationId) {
    super(tenantId, generationId);
    Object.freeze(this);
  }
}

export class GetGenerationProvenanceQuery extends AutomationGenerationQuery {
  constructor(tenantId: TenantId, generationId: GenerationId) {
    super(tenantId, generationId);
    Object.freeze(this);
  }
}

export class GetGenerationExplanationsQuery extends AutomationGenerationQuery {
  constructor(tenantId: TenantId, generationId: GenerationId) {
    super(tenantId, generationId);
    Object.freeze(this);
  }
}
