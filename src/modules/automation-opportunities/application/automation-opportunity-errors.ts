export class AutomationOpportunityError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
export class AutomationOpportunityNotFoundError extends AutomationOpportunityError {
  constructor() {
    super("AUTOMATION_OPPORTUNITY_NOT_FOUND", "Automation opportunity snapshot not found", 404);
  }
}
export class AutomationOpportunityForbiddenError extends AutomationOpportunityError {
  constructor() {
    super("AUTOMATION_OPPORTUNITY_FORBIDDEN", "Insufficient permissions", 403);
  }
}
export class AutomationOpportunityConflictError extends AutomationOpportunityError {
  constructor() {
    super("AUTOMATION_OPPORTUNITY_CONFLICT", "The snapshot was modified by another request", 409);
  }
}
export class AutomationOpportunityValidationError extends AutomationOpportunityError {
  constructor(message: string) {
    super("AUTOMATION_OPPORTUNITY_INVALID", message, 422);
  }
}
