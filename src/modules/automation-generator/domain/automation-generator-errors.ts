export abstract class AutomationGeneratorDomainError extends Error {
  protected constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class SpecificationNotPublished extends AutomationGeneratorDomainError {
  constructor() {
    super("SPECIFICATION_NOT_PUBLISHED", "Automation Specification must be published");
  }
}

export class SpecificationSnapshotNotFound extends AutomationGeneratorDomainError {
  constructor() {
    super("SPECIFICATION_SNAPSHOT_NOT_FOUND", "Automation Specification snapshot was not found");
  }
}

export class UnsupportedCapability extends AutomationGeneratorDomainError {
  constructor(readonly capabilityCodes: readonly string[]) {
    super(
      "UNSUPPORTED_CAPABILITY",
      `Unsupported capabilities: ${[...capabilityCodes].sort().join(", ")}`,
    );
  }
}

export class InvalidCatalogConfiguration extends AutomationGeneratorDomainError {
  constructor(message: string) {
    super("INVALID_CATALOG_CONFIGURATION", message);
  }
}

export class GenerationInvariantViolation extends AutomationGeneratorDomainError {
  constructor(message: string) {
    super("GENERATION_INVARIANT_VIOLATION", message);
  }
}

export class GenerationVersionConflict extends AutomationGeneratorDomainError {
  constructor() {
    super("GENERATION_VERSION_CONFLICT", "Automation Generation was modified concurrently");
  }
}

export class InvalidLifecycleTransition extends AutomationGeneratorDomainError {
  constructor(from: string, to: string) {
    super("INVALID_LIFECYCLE_TRANSITION", `Transition ${from} -> ${to} is not allowed`);
  }
}

export class GraphConstructionFailed extends AutomationGeneratorDomainError {
  constructor(message: string) {
    super("GRAPH_CONSTRUCTION_FAILED", message);
  }
}

export class CrossTenantAccessDenied extends AutomationGeneratorDomainError {
  constructor() {
    super("CROSS_TENANT_ACCESS_DENIED", "Cross-tenant Automation Generation access is denied");
  }
}

export class DomainValueError extends AutomationGeneratorDomainError {
  constructor(message: string) {
    super("INVALID_DOMAIN_VALUE", message);
  }
}
