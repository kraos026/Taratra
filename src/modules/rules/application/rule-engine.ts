import { evaluateCondition } from "../domain/rule-condition";
import { calculateRuleScores } from "../domain/rule-scores";
import type { AuditFacts, ExecutableRule } from "../domain/rule";

export class RuleEngine {
  evaluate(facts: AuditFacts, rules: readonly ExecutableRule[]) {
    const evaluations = rules.map((rule) => {
      const matched = evaluateCondition(rule.condition, facts);
      return { ...rule, matched, score: matched ? rule.weight : 0 };
    });
    return {
      matched: evaluations.filter((rule) => rule.matched),
      unmatched: evaluations.filter((rule) => !rule.matched),
      scores: calculateRuleScores(evaluations),
    };
  }
}
