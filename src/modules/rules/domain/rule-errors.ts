export class RuleError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
export class RuleForbiddenError extends RuleError {
  constructor() {
    super("RULE_FORBIDDEN", "Rule operation is not permitted", 403);
  }
}
export class RuleNotFoundError extends RuleError {
  constructor() {
    super("RULE_NOT_FOUND", "Rule or audit was not found", 404);
  }
}
export class RuleStateError extends RuleError {
  constructor(message: string) {
    super("RULE_INVALID_STATE", message, 409);
  }
}
