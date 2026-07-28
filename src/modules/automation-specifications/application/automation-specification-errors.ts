export class AutomationSpecificationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class AutomationSpecificationNotFoundError extends AutomationSpecificationError {
  constructor() {
    super("AUTOMATION_SPECIFICATION_NOT_FOUND", "Automation specification not found", 404);
  }
}

export class AutomationSpecificationForbiddenError extends AutomationSpecificationError {
  constructor() {
    super("AUTOMATION_SPECIFICATION_FORBIDDEN", "Insufficient permission", 403);
  }
}

export class AutomationSpecificationConflictError extends AutomationSpecificationError {
  constructor() {
    super("AUTOMATION_SPECIFICATION_CONFLICT", "Concurrent modification detected", 409);
  }
}

export class AutomationSpecificationValidationError extends AutomationSpecificationError {
  constructor(message = "Automation specification validation failed") {
    super("AUTOMATION_SPECIFICATION_INVALID", message, 422);
  }
}
