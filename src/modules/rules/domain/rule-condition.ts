import type { AuditFacts, FactValue, RuleCondition, RuleOperator } from "./rule";

function equal(left: FactValue | undefined, right: FactValue | undefined): boolean {
  if (Array.isArray(left) && Array.isArray(right))
    return left.length === right.length && left.every((value, index) => equal(value, right[index]));
  return left === right;
}

function empty(value: FactValue | undefined): boolean {
  return (
    value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)
  );
}

function comparable(left: FactValue | undefined, right: FactValue | undefined) {
  return (
    (typeof left === "number" && typeof right === "number") ||
    (typeof left === "string" && typeof right === "string")
  );
}

export function evaluateOperator(
  operator: RuleOperator,
  fact: FactValue | undefined,
  expected?: FactValue,
): boolean {
  switch (operator) {
    case "equal":
      return equal(fact, expected);
    case "notEqual":
      return !equal(fact, expected);
    case "greaterThan":
      return comparable(fact, expected) && fact! > expected!;
    case "greaterOrEqual":
      return comparable(fact, expected) && fact! >= expected!;
    case "lessThan":
      return comparable(fact, expected) && fact! < expected!;
    case "lessOrEqual":
      return comparable(fact, expected) && fact! <= expected!;
    case "contains":
      return typeof fact === "string" && typeof expected === "string"
        ? fact.includes(expected)
        : Array.isArray(fact) && fact.some((value) => equal(value, expected));
    case "notContains":
      return !evaluateOperator("contains", fact, expected);
    case "in":
      return Array.isArray(expected) && expected.some((value) => equal(fact, value));
    case "notIn":
      return !evaluateOperator("in", fact, expected);
    case "isEmpty":
      return empty(fact);
    case "isNotEmpty":
      return !empty(fact);
  }
}

export function evaluateCondition(condition: RuleCondition, facts: AuditFacts): boolean {
  if ("all" in condition) return condition.all.every((child) => evaluateCondition(child, facts));
  if ("any" in condition) return condition.any.some((child) => evaluateCondition(child, facts));
  if ("none" in condition) return condition.none.every((child) => !evaluateCondition(child, facts));
  return evaluateOperator(condition.operator, facts[condition.fact], condition.value);
}

export function referencedFacts(condition: RuleCondition): readonly string[] {
  if ("all" in condition) return [...new Set(condition.all.flatMap(referencedFacts))];
  if ("any" in condition) return [...new Set(condition.any.flatMap(referencedFacts))];
  if ("none" in condition) return [...new Set(condition.none.flatMap(referencedFacts))];
  return [condition.fact];
}
