import type { OrganizationRole } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { RuleEngine } from "./rule-engine";
import { ruleConditionSchema } from "./rule-schemas";
import { RuleForbiddenError, RuleNotFoundError, RuleStateError } from "../domain/rule-errors";
import type { AuditFacts, FactValue } from "../domain/rule";
import type {
  PrismaRuleRepository,
  RuleWriteInput,
} from "../infrastructure/prisma-rule-repository";

export class RuleService {
  constructor(
    private readonly repository: PrismaRuleRepository,
    private readonly userId: string,
    private readonly engine = new RuleEngine(),
  ) {}
  private async context() {
    const value = await this.repository.context(this.userId);
    if (!value) throw new RuleForbiddenError();
    return value;
  }
  private async admin() {
    const value = await this.context();
    if (!(["owner", "admin"] as OrganizationRole[]).includes(value.role))
      throw new RuleForbiddenError();
    return value;
  }
  async list(active?: boolean) {
    const context = await this.context();
    return this.repository.list(context.organizationId, active);
  }
  async create(input: RuleWriteInput) {
    const context = await this.admin();
    const category = await this.repository.category(context.organizationId, input.categoryId);
    if (!category) throw new RuleForbiddenError();
    return this.repository.create(context.organizationId, input);
  }
  async update(id: string, input: Partial<RuleWriteInput>) {
    const context = await this.admin();
    const current = await this.repository.get(context.organizationId, id);
    if (!current) throw new RuleNotFoundError();
    if (current.organizationId !== context.organizationId) throw new RuleForbiddenError();
    if (input.categoryId) {
      const category = await this.repository.category(context.organizationId, input.categoryId);
      if (!category) throw new RuleForbiddenError();
    }
    return this.repository.update(id, input);
  }
  async createVersion(id: string, input: Omit<RuleWriteInput, "code" | "version">) {
    const context = await this.admin();
    const current = await this.repository.get(context.organizationId, id);
    if (!current) throw new RuleNotFoundError();
    if (current.organizationId !== context.organizationId) throw new RuleForbiddenError();
    const category = await this.repository.category(context.organizationId, input.categoryId);
    if (!category) throw new RuleForbiddenError();
    return this.repository.createVersion(context.organizationId, current, input);
  }
  async evaluate(auditId: string) {
    const context = await this.context();
    if (context.role === "viewer") throw new RuleForbiddenError();
    const audit = await this.repository.audit(context.organizationId, auditId);
    if (!audit) throw new RuleNotFoundError();
    if (audit.status === "archived")
      throw new RuleStateError("Archived audits cannot be evaluated");
    const versions = await this.repository.evaluationRules(context.organizationId);
    const latest = new Map<string, (typeof versions)[number]>();
    for (const rule of versions) {
      const key = `${rule.organizationId ?? "system"}:${rule.code}`;
      if (!latest.has(key)) latest.set(key, rule);
    }
    const rules = [...latest.values()]
      .filter((rule) => rule.active)
      .sort((left, right) => left.priority - right.priority || left.code.localeCompare(right.code));
    const facts: Record<string, FactValue> = {};
    for (const answer of audit.answers) facts[answer.question.code] = answer.valueJson as FactValue;
    const executable = rules.map((rule) => ({
      id: rule.id,
      code: rule.code,
      version: rule.version,
      name: rule.name,
      categoryId: rule.categoryId,
      categoryCode: rule.category.code,
      priority: rule.priority,
      severity: rule.severity,
      weight: Number(rule.weight),
      condition: ruleConditionSchema.parse(rule.conditionJson),
      result: rule.resultJson as Record<string, unknown>,
    }));
    const evaluation = this.engine.evaluate(facts as AuditFacts, executable);
    const evaluationId = randomUUID();
    const evaluatedAt = new Date();
    await this.repository.storeEvaluation(
      context.organizationId,
      auditId,
      [...evaluation.matched, ...evaluation.unmatched],
      evaluation.scores,
      evaluationId,
      evaluatedAt,
    );
    return { ...evaluation, evaluationId, evaluatedAt };
  }
  async results(auditId: string) {
    const context = await this.context();
    const results = await this.repository.results(context.organizationId, auditId);
    if (!results) throw new RuleNotFoundError();
    return {
      ...results,
      ruleMatches: results.ruleMatches.map((match) => ({
        ...match,
        snapshot: match.detailsJson,
      })),
    };
  }
}
