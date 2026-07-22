export class QuestionnaireError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
export class QuestionnaireForbiddenError extends QuestionnaireError {
  constructor() {
    super("QUESTIONNAIRE_FORBIDDEN", "Questionnaire operation is not permitted", 403);
  }
}
export class QuestionnaireNotFoundError extends QuestionnaireError {
  constructor() {
    super("QUESTIONNAIRE_NOT_FOUND", "Questionnaire resource was not found", 404);
  }
}
export class QuestionnaireImmutableError extends QuestionnaireError {
  constructor() {
    super("QUESTIONNAIRE_IMMUTABLE", "Only draft questionnaire versions can be modified", 409);
  }
}
export class AnswerValidationError extends QuestionnaireError {
  constructor(message: string) {
    super("INVALID_ANSWER", message, 422);
  }
}
