export class AuditError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
export class AuditForbiddenError extends AuditError {
  constructor() {
    super("AUDIT_FORBIDDEN", "Audit operation is not permitted", 403);
  }
}
export class AuditNotFoundError extends AuditError {
  constructor() {
    super("AUDIT_NOT_FOUND", "Audit was not found", 404);
  }
}
export class AuditStateError extends AuditError {
  constructor(message: string) {
    super("AUDIT_INVALID_STATE", message, 409);
  }
}
export class AuditIncompleteError extends AuditError {
  constructor() {
    super("AUDIT_INCOMPLETE", "All required questions must have a valid answer", 422);
  }
}
export class AuditSectionMismatchError extends AuditError {
  constructor() {
    super(
      "AUDIT_SECTION_MISMATCH",
      "Current section must belong to the audit questionnaire version",
      422,
    );
  }
}
