export class RoiEvaluationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
export class RoiNotFoundError extends RoiEvaluationError {
  constructor() {
    super("ROI_NOT_FOUND", "ROI snapshot not found", 404);
  }
}
export class RoiForbiddenError extends RoiEvaluationError {
  constructor() {
    super("ROI_FORBIDDEN", "Insufficient permissions", 403);
  }
}
export class RoiConflictError extends RoiEvaluationError {
  constructor() {
    super("ROI_CONFLICT", "The ROI snapshot was modified by another request", 409);
  }
}
export class RoiValidationError extends RoiEvaluationError {
  constructor(message: string) {
    super("ROI_INVALID", message, 422);
  }
}
