export class ProcessMapError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export class ProcessMapForbiddenError extends ProcessMapError {
  constructor() {
    super("FORBIDDEN", 403, "Process mapping action is not permitted");
  }
}
export class ProcessMapNotFoundError extends ProcessMapError {
  constructor() {
    super("NOT_FOUND", 404, "Process map not found");
  }
}
export class ProcessMapConflictError extends ProcessMapError {
  constructor() {
    super("CONFLICT", 409, "Process map was modified elsewhere");
  }
}
export class ProcessMapValidationError extends ProcessMapError {
  constructor(message: string) {
    super("VALIDATION_ERROR", 422, message);
  }
}
