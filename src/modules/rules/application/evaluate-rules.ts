import type { AuditFacts, BusinessRule, RuleResult } from "../domain/rule";

export function evaluateRules(facts: AuditFacts, rules: readonly BusinessRule[]): readonly RuleResult[] {
  return rules.flatMap((rule) => {
    const result = rule.evaluate(facts);
    return result ? [result] : [];
  });
}
