import type { CategoryScore, EvaluatedRule } from "./rule";

function percentage(score: number, total: number) {
  return total === 0 ? 0 : Math.round((score / total) * 10000) / 100;
}

export function calculateRuleScores(rules: readonly EvaluatedRule[]): readonly CategoryScore[] {
  const categories = new Map<string, CategoryScore>();
  for (const rule of rules) {
    const current = categories.get(rule.categoryId) ?? {
      categoryId: rule.categoryId,
      categoryCode: rule.categoryCode,
      score: 0,
      total: 0,
      percentage: 0,
    };
    const score = current.score + rule.score;
    const total = current.total + rule.weight;
    categories.set(rule.categoryId, {
      ...current,
      score,
      total,
      percentage: percentage(score, total),
    });
  }
  const categoryScores = [...categories.values()];
  const score = categoryScores.reduce((sum, category) => sum + category.score, 0);
  const total = categoryScores.reduce((sum, category) => sum + category.total, 0);
  return [
    ...categoryScores,
    {
      categoryId: null,
      categoryCode: "global",
      score,
      total,
      percentage: percentage(score, total),
    },
  ];
}
