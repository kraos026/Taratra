import type { Prisma } from "@/generated/prisma/client";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import type { CategoryScore, EvaluatedRule } from "../domain/rule";

export class PrismaRuleRepository {
  constructor(private readonly db: TransactionClient) {}
  context(userId: string) {
    return this.db.organizationMember.findFirst({
      where: { userId },
      select: { organizationId: true, role: true },
    });
  }
  list(organizationId: string, active?: boolean) {
    return this.db.rule.findMany({
      where: {
        OR: [{ organizationId: null }, { organizationId }],
        ...(active === undefined ? {} : { active }),
      },
      include: { category: true, results: true },
      orderBy: [{ priority: "asc" }, { code: "asc" }, { version: "desc" }],
    });
  }
  get(organizationId: string, id: string) {
    return this.db.rule.findFirst({
      where: { id, OR: [{ organizationId: null }, { organizationId }] },
      include: { category: true },
    });
  }
  category(organizationId: string, id: string) {
    return this.db.ruleCategory.findFirst({
      where: { id, OR: [{ organizationId: null }, { organizationId }] },
    });
  }
  create(organizationId: string, input: RuleWriteInput) {
    return this.db.rule.create({
      data: {
        ...input,
        organizationId,
        conditionJson: input.conditionJson as Prisma.InputJsonValue,
        resultJson: input.resultJson as Prisma.InputJsonValue,
      },
    });
  }
  update(id: string, input: Partial<RuleWriteInput>) {
    return this.db.rule.update({
      where: { id },
      data: {
        ...input,
        conditionJson: input.conditionJson as Prisma.InputJsonValue | undefined,
        resultJson: input.resultJson as Prisma.InputJsonValue | undefined,
      },
    });
  }
  async createVersion(
    organizationId: string,
    current: { code: string },
    input: Omit<RuleWriteInput, "code" | "version">,
  ) {
    await this.db
      .$executeRaw`select pg_advisory_xact_lock(hashtextextended(${`${organizationId}:${current.code}`}, 0))`;
    const latest = await this.db.rule.aggregate({
      where: { organizationId, code: current.code },
      _max: { version: true },
    });
    return this.create(organizationId, {
      ...input,
      code: current.code,
      version: (latest._max.version ?? 0) + 1,
    });
  }
  audit(organizationId: string, auditId: string) {
    return this.db.audit.findFirst({
      where: { id: auditId, organizationId, deletedAt: null },
      include: { answers: { include: { question: { select: { code: true } } } } },
    });
  }
  evaluationRules(organizationId: string) {
    return this.db.rule.findMany({
      where: {
        category: { active: true },
        OR: [{ organizationId: null }, { organizationId }],
      },
      include: { category: true },
      orderBy: [{ code: "asc" }, { version: "desc" }],
    });
  }
  async storeEvaluation(
    organizationId: string,
    auditId: string,
    rules: readonly EvaluatedRule[],
    scores: readonly CategoryScore[],
    evaluationId: string,
    evaluatedAt: Date,
  ) {
    await this.db.auditRuleMatch.deleteMany({ where: { auditId, organizationId } });
    await this.db.auditScore.deleteMany({ where: { auditId, organizationId } });
    if (rules.length)
      await this.db.auditRuleMatch.createMany({
        data: rules.map((rule) => ({
          organizationId,
          auditId,
          ruleId: rule.id,
          evaluationId,
          matched: rule.matched,
          score: rule.score,
          evaluatedAt,
          detailsJson: rule.snapshot as Prisma.InputJsonValue,
        })),
      });
    if (scores.length)
      await this.db.auditScore.createMany({
        data: scores.map((score) => ({
          organizationId,
          auditId,
          categoryId: score.categoryId,
          evaluationId,
          score: score.score,
          total: score.total,
          percentage: score.percentage,
          evaluatedAt,
        })),
      });
  }
  results(organizationId: string, auditId: string) {
    return this.db.audit.findFirst({
      where: { id: auditId, organizationId, deletedAt: null },
      include: {
        ruleMatches: { orderBy: [{ matched: "desc" }, { evaluatedAt: "desc" }] },
        scores: { include: { category: true }, orderBy: { percentage: "desc" } },
      },
    });
  }
}

export type RuleWriteInput = {
  categoryId: string;
  code: string;
  name: string;
  description?: string;
  priority: number;
  severity: "info" | "low" | "medium" | "high" | "critical";
  weight: number;
  conditionJson: unknown;
  resultJson: Record<string, unknown>;
  active: boolean;
  version: number;
};
