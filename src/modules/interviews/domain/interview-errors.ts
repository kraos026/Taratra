export class InterviewError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export class InterviewForbiddenError extends InterviewError {
  constructor() {
    super("FORBIDDEN", 403, "Interview action is not permitted");
  }
}
export class InterviewNotFoundError extends InterviewError {
  constructor() {
    super("NOT_FOUND", 404, "Interview session not found");
  }
}
export class InterviewConflictError extends InterviewError {
  constructor() {
    super("CONFLICT", 409, "Interview session was modified elsewhere");
  }
}
export class InterviewValidationError extends InterviewError {
  constructor(message: string) {
    super("VALIDATION_ERROR", 422, message);
  }
}
