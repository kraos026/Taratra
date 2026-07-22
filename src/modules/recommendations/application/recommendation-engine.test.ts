import { describe, expect, it } from "vitest";
import { RecommendationEngine } from "./recommendation-engine";
describe("RecommendationEngine", () => {
  it("returns multiple recommendations in deterministic order", () => {
    const result = new RecommendationEngine().evaluate(
      [
        {
          id: "1",
          code: "LOW",
          difficulty: "low",
          hoursMonth: 1,
          implementationCost: 1000,
          additionalAnnualSavings: 0,
          rulePriority: 2,
        },
        {
          id: "2",
          code: "HIGH",
          difficulty: "low",
          hoursMonth: 20,
          implementationCost: 1000,
          additionalAnnualSavings: 0,
          rulePriority: 1,
        },
      ],
      50,
    );
    expect(result.map((x) => x.code)).toEqual(["HIGH", "LOW"]);
    expect(result[0]?.quickWin).toBe(true);
  });
  it("returns an empty list when no rule has a recommendation", () =>
    expect(new RecommendationEngine().evaluate([], 35)).toEqual([]));
});
