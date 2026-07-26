import { describe, expect, it } from "vitest";
import { InterviewEngine, type InterviewQuestionDefinition } from "./interview-engine";

const questions: InterviewQuestionDefinition[] = [
  {
    id: "base",
    code: "finance.email",
    domain: "finance",
    prompt: "Email?",
    answerType: "boolean",
    options: [],
    mandatory: true,
    weight: 2,
    sequence: 1,
    condition: {},
    validation: {},
  },
  {
    id: "follow",
    code: "finance.volume",
    domain: "finance",
    prompt: "Volume?",
    answerType: "number",
    options: [],
    mandatory: true,
    weight: 2,
    sequence: 2,
    condition: { fact: "answer.finance.email", operator: "equal", value: true },
    validation: { min: 0 },
  },
  {
    id: "restaurant",
    code: "restaurant.pos",
    domain: "software",
    prompt: "POS?",
    answerType: "short_text",
    options: [],
    mandatory: true,
    weight: 1,
    sequence: 3,
    condition: { fact: "discovery.industry", operator: "contains", value: "restaurant" },
    validation: {},
  },
];

describe("InterviewEngine", () => {
  const engine = new InterviewEngine();

  it("branches from Discovery and answers", () => {
    expect(engine.eligibleQuestions(questions, { industry: "Restaurant" }, [])).toHaveLength(2);
    expect(
      engine.eligibleQuestions(questions, { industry: "Restaurant" }, [
        {
          questionId: "base",
          code: "finance.email",
          value: true,
          confidence: "confirmed",
          skipReason: null,
        },
      ]),
    ).toHaveLength(3);
  });

  it("returns the next unanswered eligible question", () => {
    expect(engine.nextQuestion(questions, { industry: "services" }, [])?.id).toBe("base");
  });

  it("calculates completeness, confidence and readiness", () => {
    const result = engine.calculateProgress(questions, { industry: "services" }, [
      {
        questionId: "base",
        code: "finance.email",
        value: false,
        confidence: "uncertain",
        skipReason: null,
      },
    ]);
    expect(result.progressPercentage).toBe(100);
    expect(result.confidencePercentage).toBe(50);
    expect(result.readyForProcessMapping).toBe(false);
  });

  it("validates deterministic answer constraints", () => {
    expect(engine.validateAnswer(questions[1]!, -1)).toBe(false);
    expect(engine.validateAnswer(questions[1]!, 12)).toBe(true);
  });
});
