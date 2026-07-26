export class BusinessAnalysisError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export class BusinessAnalysisForbiddenError extends BusinessAnalysisError {
  constructor() {
    super("FORBIDDEN", 403, "Business analysis action is not permitted");
  }
}
export class BusinessAnalysisNotFoundError extends BusinessAnalysisError {
  constructor() {
    super("NOT_FOUND", 404, "Business analysis was not found");
  }
}
export class BusinessAnalysisConflictError extends BusinessAnalysisError {
  constructor() {
    super("CONFLICT", 409, "Business analysis was modified elsewhere");
  }
}
export class BusinessAnalysisValidationError extends BusinessAnalysisError {
  constructor(message: string) {
    super("VALIDATION_ERROR", 422, message);
  }
}
