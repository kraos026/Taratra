import { evaluateCondition, referencedFacts } from "../domain/rule-condition";
import { calculateRuleScores } from "../domain/rule-scores";
import type { AuditFacts, ExecutableRule } from "../domain/rule";

export class RuleEngine {
  evaluate(facts: AuditFacts, rules: readonly ExecutableRule[]) {
    const evaluations = rules.map((rule) => {
      const matched = evaluateCondition(rule.condition, facts);
      const score = matched ? rule.weight : 0;
      const factNames = referencedFacts(rule.condition);
      return {
        ...rule,
        matched,
        score,
        snapshot: {
          ruleId: rule.id,
          ruleCode: rule.code,
          ruleVersion: rule.version,
          ruleName: rule.name,
          categoryId: rule.categoryId,
          categoryCode: rule.categoryCode,
          priority: rule.priority,
          severity: rule.severity,
          weight: rule.weight,
          conditionJson: rule.condition,
          resultJson: rule.result,
          matched,
          score,
          facts: Object.fromEntries(factNames.map((name) => [name, facts[name] ?? null])),
        },
      };
    });
    return {
      matched: evaluations.filter((rule) => rule.matched),
      unmatched: evaluations.filter((rule) => !rule.matched),
      scores: calculateRuleScores(evaluations),
    };
  }
}
