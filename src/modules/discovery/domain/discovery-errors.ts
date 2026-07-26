export class DiscoveryError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export class DiscoveryForbiddenError extends DiscoveryError {
  constructor() {
    super("FORBIDDEN", 403, "Forbidden");
  }
}
export class DiscoveryNotFoundError extends DiscoveryError {
  constructor() {
    super("NOT_FOUND", 404, "Discovery session not found");
  }
}
export class DiscoveryConflictError extends DiscoveryError {
  constructor() {
    super("CONFLICT", 409, "Discovery session was modified elsewhere");
  }
}
export class DiscoveryValidationError extends DiscoveryError {
  constructor(message = "Discovery is incomplete") {
    super("VALIDATION_ERROR", 422, message);
  }
}
