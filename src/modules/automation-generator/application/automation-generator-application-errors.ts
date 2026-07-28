export abstract class AutomationGeneratorApplicationError extends Error {
  protected constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class AutomationGenerationNotFound extends AutomationGeneratorApplicationError {
  constructor() {
    super("AUTOMATION_GENERATION_NOT_FOUND", "Automation Generation was not found");
  }
}

export class PublishedSpecificationNotFound extends AutomationGeneratorApplicationError {
  constructor() {
    super(
      "PUBLISHED_SPECIFICATION_NOT_FOUND",
      "Published Automation Specification snapshot was not found",
    );
  }
}

export class PublishedGenerationRuleCatalogNotFound extends AutomationGeneratorApplicationError {
  constructor() {
    super(
      "PUBLISHED_GENERATION_RULE_CATALOG_NOT_FOUND",
      "Published compatible Generation Rule Catalog was not found",
    );
  }
}

export class IdempotencyKeyConflict extends AutomationGeneratorApplicationError {
  constructor() {
    super(
      "IDEMPOTENCY_KEY_REUSED",
      "Idempotency key was already used with a different command payload",
    );
  }
}

export class IdempotencyCommandInProgress extends AutomationGeneratorApplicationError {
  constructor() {
    super("IDEMPOTENCY_IN_PROGRESS", "The idempotent command is already in progress");
  }
}

export class AutomationGraphNotGenerated extends AutomationGeneratorApplicationError {
  constructor() {
    super("GRAPH_NOT_GENERATED", "Automation Generation does not contain a graph");
  }
}
