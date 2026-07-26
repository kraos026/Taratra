export class AiOpportunityError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export class AiOpportunityForbiddenError extends AiOpportunityError {
  constructor() {
    super("FORBIDDEN", 403, "AI opportunity action is not permitted");
  }
}
export class AiOpportunityNotFoundError extends AiOpportunityError {
  constructor() {
    super("NOT_FOUND", 404, "AI opportunity snapshot was not found");
  }
}
export class AiOpportunityConflictError extends AiOpportunityError {
  constructor() {
    super("CONFLICT", 409, "AI opportunity snapshot was modified elsewhere");
  }
}
export class AiOpportunityValidationError extends AiOpportunityError {
  constructor(message: string) {
    super("VALIDATION_ERROR", 422, message);
  }
}
