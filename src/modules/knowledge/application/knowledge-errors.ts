export class KnowledgeProjectionError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = knowledgeErrorStatus(code),
  ) {
    super(message);
  }
}

function knowledgeErrorStatus(code: string): number {
  switch (code) {
    case "FORBIDDEN":
      return 403;
    case "COMPANY_NOT_FOUND":
      return 404;
    case "DISCOVERY_REQUIRED":
    case "INVALID_SOURCE_STATE":
      return 409;
    default:
      return 500;
  }
}
