import { describe, expect, it, vi } from "vitest";
import type { PrismaRuleRepository } from "../infrastructure/prisma-rule-repository";
import { RuleService } from "./rule-service";
function repository(overrides: Record<string, unknown> = {}) {
  return {
    context: vi.fn().mockResolvedValue({ organizationId: "org", role: "consultant" }),
    audit: vi.fn().mockResolvedValue({
      status: "completed",
      answers: [{ valueJson: false, question: { code: "crm_used" } }],
    }),
    evaluationRules: vi.fn().mockResolvedValue([
      {
        id: "rule",
        organizationId: null,
        code: "CRM_ABSENT",
        categoryId: "category",
        category: { code: "sales" },
        weight: 5,
        priority: 10,
        active: true,
        version: 1,
        conditionJson: { fact: "crm_used", operator: "equal", value: false },
        resultJson: {},
      },
    ]),
    storeEvaluation: vi.fn(),
    results: vi.fn().mockResolvedValue({ id: "audit" }),
    ...overrides,
  } as unknown as PrismaRuleRepository;
}
describe("RuleService", () => {
  it("evaluates answers and stores matches and scores", async () => {
    const repo = repository();
    const result = await new RuleService(repo, "user").evaluate("audit");
    expect(result.matched).toHaveLength(1);
    expect(repo.storeEvaluation).toHaveBeenCalledOnce();
  });
  it("keeps viewers from executing evaluations", async () => {
    const repo = repository({
      context: vi.fn().mockResolvedValue({ organizationId: "org", role: "viewer" }),
    });
    await expect(new RuleService(repo, "user").evaluate("audit")).rejects.toMatchObject({
      code: "RULE_FORBIDDEN",
    });
  });
  it("does not store when the audit belongs to another tenant", async () => {
    const repo = repository({ audit: vi.fn().mockResolvedValue(null) });
    await expect(new RuleService(repo, "user").evaluate("other-audit")).rejects.toMatchObject({
      code: "RULE_NOT_FOUND",
    });
    expect(repo.storeEvaluation).not.toHaveBeenCalled();
  });
  it("does not reactivate an older version when the latest is disabled", async () => {
    const base = {
      organizationId: null,
      code: "CRM_ABSENT",
      categoryId: "category",
      category: { code: "sales" },
      weight: 5,
      priority: 10,
      conditionJson: { fact: "crm_used", operator: "equal", value: false },
      resultJson: {},
    };
    const repo = repository({
      evaluationRules: vi.fn().mockResolvedValue([
        { ...base, id: "new", version: 2, active: false },
        { ...base, id: "old", version: 1, active: true },
      ]),
    });
    const result = await new RuleService(repo, "user").evaluate("audit");
    expect(result.matched).toHaveLength(0);
    expect(result.unmatched).toHaveLength(0);
  });
});
