export type InterviewConfidence = "validated" | "confirmed" | "uncertain" | "missing";
export type InterviewCondition =
  | Record<string, never>
  | { fact: string; operator: "equal" | "contains" | "exists"; value?: unknown };

export interface InterviewQuestionDefinition {
  id: string;
  code: string;
  domain: string;
  prompt: string;
  answerType: string;
  options: unknown;
  mandatory: boolean;
  weight: number;
  sequence: number;
  condition: InterviewCondition;
  validation: Record<string, unknown>;
}

export interface InterviewAnswerValue {
  questionId: string;
  code: string;
  value: unknown | null;
  confidence: InterviewConfidence;
  skipReason: "irrelevant" | "unknown" | "deferred" | null;
}

export interface InterviewProgressResult {
  domains: {
    domain: string;
    answeredWeight: number;
    requiredWeight: number;
    progressPercentage: number;
    confidencePercentage: number;
    missingMandatory: number;
    ready: boolean;
  }[];
  progressPercentage: number;
  confidencePercentage: number;
  missingMandatory: string[];
  readyForProcessMapping: boolean;
}

const confidenceFactor: Record<InterviewConfidence, number> = {
  validated: 1,
  confirmed: 1,
  uncertain: 0.5,
  missing: 0,
};

export class InterviewEngine {
  eligibleQuestions(
    questions: InterviewQuestionDefinition[],
    discoveryFacts: Record<string, unknown>,
    answers: InterviewAnswerValue[],
  ) {
    const facts = this.facts(discoveryFacts, answers);
    return questions
      .filter((question) => this.matches(question.condition, facts))
      .sort((left, right) => left.sequence - right.sequence || left.code.localeCompare(right.code));
  }

  nextQuestion(
    questions: InterviewQuestionDefinition[],
    discoveryFacts: Record<string, unknown>,
    answers: InterviewAnswerValue[],
  ) {
    const answered = new Set(answers.map((answer) => answer.questionId));
    return (
      this.eligibleQuestions(questions, discoveryFacts, answers).find(
        (question) => !answered.has(question.id),
      ) ?? null
    );
  }

  calculateProgress(
    questions: InterviewQuestionDefinition[],
    discoveryFacts: Record<string, unknown>,
    answers: InterviewAnswerValue[],
  ): InterviewProgressResult {
    const eligible = this.eligibleQuestions(questions, discoveryFacts, answers);
    const byQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));
    const domains = [...new Set(eligible.map((question) => question.domain))].map((domain) => {
      const required = eligible.filter(
        (question) => question.domain === domain && question.mandatory,
      );
      const requiredWeight = sum(required.map((question) => question.weight));
      const answeredWeight = sum(
        required.map((question) => {
          const answer = byQuestion.get(question.id);
          return answer && answer.value !== null ? question.weight : 0;
        }),
      );
      const confidenceWeight = sum(
        required.map((question) => {
          const answer = byQuestion.get(question.id);
          return question.weight * confidenceFactor[answer?.confidence ?? "missing"];
        }),
      );
      const missingMandatory = required.filter(
        (question) => byQuestion.get(question.id)?.value == null,
      ).length;
      const progressPercentage = percentage(answeredWeight, requiredWeight);
      const confidencePercentage = percentage(confidenceWeight, requiredWeight);
      return {
        domain,
        answeredWeight,
        requiredWeight,
        progressPercentage,
        confidencePercentage,
        missingMandatory,
        ready: missingMandatory === 0 && confidencePercentage >= 80,
      };
    });
    const mandatory = eligible.filter((question) => question.mandatory);
    const totalWeight = sum(mandatory.map((question) => question.weight));
    const answeredWeight = sum(
      mandatory.map((question) =>
        byQuestion.get(question.id)?.value == null ? 0 : question.weight,
      ),
    );
    const confidenceWeight = sum(
      mandatory.map(
        (question) =>
          question.weight * confidenceFactor[byQuestion.get(question.id)?.confidence ?? "missing"],
      ),
    );
    const missingMandatory = mandatory
      .filter((question) => byQuestion.get(question.id)?.value == null)
      .map((question) => question.code);
    const confidencePercentage = percentage(confidenceWeight, totalWeight);
    return {
      domains,
      progressPercentage: percentage(answeredWeight, totalWeight),
      confidencePercentage,
      missingMandatory,
      readyForProcessMapping: missingMandatory.length === 0 && confidencePercentage >= 80,
    };
  }

  validateAnswer(question: InterviewQuestionDefinition, value: unknown) {
    const validation = question.validation;
    if (question.answerType === "boolean" && typeof value !== "boolean") return false;
    if (question.answerType === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) return false;
      if (typeof validation.min === "number" && value < validation.min) return false;
      if (typeof validation.max === "number" && value > validation.max) return false;
    }
    if (["short_text", "long_text"].includes(question.answerType)) {
      if (typeof value !== "string") return false;
      if (typeof validation.minLength === "number" && value.trim().length < validation.minLength)
        return false;
    }
    const options = question.options;
    if (question.answerType === "single_choice")
      return Array.isArray(options) && options.includes(value);
    if (question.answerType === "multiple_choice")
      return (
        Array.isArray(value) &&
        Array.isArray(options) &&
        value.every((item) => options.includes(item))
      );
    return true;
  }

  private facts(discovery: Record<string, unknown>, answers: InterviewAnswerValue[]) {
    return Object.assign(
      {},
      Object.fromEntries(
        Object.entries(discovery).map(([key, value]) => [`discovery.${key}`, value]),
      ),
      Object.fromEntries(answers.map((answer) => [`answer.${answer.code}`, answer.value])),
    );
  }

  private matches(condition: InterviewCondition, facts: Record<string, unknown>) {
    if (!("fact" in condition)) return true;
    const actual = facts[condition.fact];
    if (condition.operator === "exists")
      return actual !== null && actual !== undefined && actual !== "";
    if (condition.operator === "equal") return Object.is(actual, condition.value);
    if (condition.operator === "contains")
      return typeof actual === "string" && typeof condition.value === "string"
        ? actual.toLowerCase().includes(condition.value.toLowerCase())
        : Array.isArray(actual) && actual.includes(condition.value);
    return false;
  }
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function percentage(value: number, total: number) {
  return total === 0 ? 100 : Math.round((value / total) * 10000) / 100;
}
