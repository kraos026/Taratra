export class SolutionBlueprintError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export class SolutionBlueprintNotFoundError extends SolutionBlueprintError {
  constructor() {
    super("SOLUTION_BLUEPRINT_NOT_FOUND", 404, "Solution Blueprint not found");
  }
}
export class SolutionBlueprintForbiddenError extends SolutionBlueprintError {
  constructor() {
    super("SOLUTION_BLUEPRINT_FORBIDDEN", 403, "Operation is not permitted");
  }
}
export class SolutionBlueprintConflictError extends SolutionBlueprintError {
  constructor() {
    super("SOLUTION_BLUEPRINT_CONFLICT", 409, "The blueprint was modified concurrently");
  }
}
export class SolutionBlueprintValidationError extends SolutionBlueprintError {
  constructor(message: string) {
    super("SOLUTION_BLUEPRINT_INVALID", 422, message);
  }
}
