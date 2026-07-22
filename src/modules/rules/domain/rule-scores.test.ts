import { describe, expect, it } from "vitest";
import { calculateRuleScores } from "./rule-scores";
const rule = (categoryId: string, weight: number, score: number) => ({
  id: `${categoryId}-${weight}`,
  code: "RULE",
  version: 1,
  name: "Rule",
  categoryId,
  categoryCode: categoryId,
  priority: 1,
  severity: "medium",
  weight,
  condition: { fact: "x", operator: "equal" as const, value: true },
  result: {},
  matched: score > 0,
  score,
  snapshot: {},
});
describe("calculateRuleScores edge cases", () => {
  it("returns global zero without active rules", () =>
    expect(calculateRuleScores([])).toEqual([
      { categoryId: null, categoryCode: "global", score: 0, total: 0, percentage: 0 },
    ]));
  it("keeps zero-weight rules bounded", () =>
    expect(calculateRuleScores([rule("a", 0, 0)])[1]?.percentage).toBe(0));
  it("keeps percentages between zero and one hundred", () => {
    const scores = calculateRuleScores([rule("a", 2, 2), rule("b", 3, 0)]);
    expect(scores.every((score) => score.percentage >= 0 && score.percentage <= 100)).toBe(true);
  });
});
