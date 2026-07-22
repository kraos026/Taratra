export class CompanyError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CompanyError";
  }
}

export class CompanyNotFoundError extends CompanyError {
  constructor() {
    super("Company not found", "COMPANY_NOT_FOUND", 404);
  }
}

export class CompanyPermissionError extends CompanyError {
  constructor() {
    super("Insufficient permissions", "COMPANY_FORBIDDEN", 403);
  }
}

export class CompanyDependencyError extends CompanyError {
  constructor() {
    super("Company cannot be deleted while dependencies exist", "COMPANY_HAS_DEPENDENCIES", 409);
  }
}
