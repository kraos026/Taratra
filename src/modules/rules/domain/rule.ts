export type AuditAnswer = string | number | boolean | readonly string[];

export interface AuditFacts {
  readonly answers: Readonly<Record<string, AuditAnswer>>;
  readonly sectorId: string;
}

export interface RuleResult {
  readonly ruleId: string;
  readonly recommendationId: string;
  readonly evidence: readonly string[];
}

export interface BusinessRule {
  readonly id: string;
  readonly version: number;
  evaluate(facts: AuditFacts): RuleResult | null;
}
