import { AnswerValidationError } from "./questionnaire-errors";
import type { QuestionDefinition, ValidationRules } from "./questionnaire";

function rules(value: unknown): ValidationRules {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as ValidationRules)
    : {};
}
function options(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}
function validIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function validateAnswer(question: QuestionDefinition, value: unknown): unknown {
  const validation = rules(question.validationJson);
  const fail = (message: string): never => {
    throw new AnswerValidationError(message);
  };
  if (["short_text", "long_text"].includes(question.questionType)) {
    if (typeof value !== "string") fail("Answer must be text");
    const textValue = value as string;
    if (validation.minLength !== undefined && textValue.length < validation.minLength)
      fail(`Answer must contain at least ${validation.minLength} characters`);
    if (validation.maxLength !== undefined && textValue.length > validation.maxLength)
      fail(`Answer must contain at most ${validation.maxLength} characters`);
    if (validation.pattern !== undefined) {
      try {
        if (!new RegExp(validation.pattern).test(textValue))
          fail("Answer does not match the required format");
      } catch {
        fail("Question validation pattern is invalid");
      }
    }
    return textValue;
  }
  if (["number", "percentage", "currency"].includes(question.questionType)) {
    if (typeof value !== "number" || !Number.isFinite(value))
      fail("Answer must be a finite number");
    const numericValue = value as number;
    if (question.questionType === "percentage" && (numericValue < 0 || numericValue > 100))
      fail("Percentage must be between 0 and 100");
    if (question.questionType === "currency" && numericValue < 0)
      fail("Currency must be positive or zero");
    if (validation.min !== undefined && numericValue < validation.min)
      fail(`Answer must be at least ${validation.min}`);
    if (validation.max !== undefined && numericValue > validation.max)
      fail(`Answer must be at most ${validation.max}`);
    return numericValue;
  }
  if (question.questionType === "boolean") {
    if (typeof value !== "boolean") fail("Answer must be a boolean");
    return value;
  }
  if (question.questionType === "single_choice") {
    if (!options(question.optionsJson).includes(value)) fail("Answer is not an allowed option");
    return value;
  }
  if (question.questionType === "multiple_choice") {
    if (
      !Array.isArray(value) ||
      value.some((item) => !options(question.optionsJson).includes(item))
    )
      fail("Answer contains an invalid option");
    return [...new Set(value as unknown[])];
  }
  if (question.questionType === "date") {
    if (typeof value !== "string" || !validIsoDate(value)) fail("Answer must be a valid ISO date");
    return value;
  }
  return fail("Unsupported question type");
}
