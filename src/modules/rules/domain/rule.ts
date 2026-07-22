export const ruleOperators = [
  "equal",
  "notEqual",
  "greaterThan",
  "greaterOrEqual",
  "lessThan",
  "lessOrEqual",
  "contains",
  "notContains",
  "in",
  "notIn",
  "isEmpty",
  "isNotEmpty",
] as const;

export type RuleOperator = (typeof ruleOperators)[number];
export type FactValue = string | number | boolean | null | readonly FactValue[];
export type AuditFacts = Readonly<Record<string, FactValue | undefined>>;

export type RuleCondition =
  | { readonly fact: string; readonly operator: RuleOperator; readonly value?: FactValue }
  | { readonly all: readonly RuleCondition[] }
  | { readonly any: readonly RuleCondition[] }
  | { readonly none: readonly RuleCondition[] };

export interface ExecutableRule {
  readonly id: string;
  readonly code: string;
  readonly categoryId: string;
  readonly categoryCode: string;
  readonly weight: number;
  readonly condition: RuleCondition;
  readonly result: Readonly<Record<string, unknown>>;
}

export interface EvaluatedRule extends ExecutableRule {
  readonly matched: boolean;
  readonly score: number;
}

export interface CategoryScore {
  readonly categoryId: string | null;
  readonly categoryCode: string;
  readonly score: number;
  readonly total: number;
  readonly percentage: number;
}
