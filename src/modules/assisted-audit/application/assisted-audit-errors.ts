export class AssistedAuditError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "COMPANY_NOT_FOUND",
    message: string,
    readonly status: 403 | 404,
  ) {
    super(message);
  }
}
