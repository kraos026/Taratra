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
    get: vi.fn().mockResolvedValue({ id: "rule", code: "CUSTOM", organizationId: "org" }),
    category: vi.fn().mockResolvedValue({ id: "category", organizationId: "org" }),
    createVersion: vi.fn().mockResolvedValue({ id: "v2", version: 2 }),
    update: vi.fn(),
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
  it("creates a new version without rewriting the previous one", async () => {
    const repo = repository({
      context: vi.fn().mockResolvedValue({ organizationId: "org", role: "admin" }),
    });
    const input = {
      categoryId: "category",
      name: "V2",
      priority: 1,
      severity: "high" as const,
      weight: 2,
      conditionJson: { fact: "x", operator: "isEmpty" },
      resultJson: {},
      active: true,
    };
    await expect(new RuleService(repo, "user").createVersion("rule", input)).resolves.toMatchObject(
      { version: 2 },
    );
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.createVersion).toHaveBeenCalledWith(
      "org",
      expect.objectContaining({ code: "CUSTOM" }),
      input,
    );
  });
  it("cannot version a system rule", async () => {
    const repo = repository({
      context: vi.fn().mockResolvedValue({ organizationId: "org", role: "admin" }),
      get: vi.fn().mockResolvedValue({ code: "SYSTEM", organizationId: null }),
    });
    await expect(
      new RuleService(repo, "user").createVersion("rule", {} as never),
    ).rejects.toMatchObject({ code: "RULE_FORBIDDEN" });
  });
  it("snapshots v1 before a later evaluation uses v2", async () => {
    const repo = repository();
    await new RuleService(repo, "user").evaluate("audit");
    const firstRules = vi.mocked(repo.storeEvaluation).mock.calls[0]?.[2];
    expect(firstRules?.[0]?.snapshot).toMatchObject({ ruleVersion: 1 });
    vi.mocked(repo.evaluationRules).mockResolvedValue([
      {
        id: "rule-v2",
        organizationId: null,
        code: "CRM_ABSENT",
        name: "V2",
        version: 2,
        categoryId: "category",
        category: { code: "sales" },
        weight: 7,
        priority: 1,
        severity: "high",
        active: true,
        conditionJson: { fact: "crm_used", operator: "equal", value: false },
        resultJson: {},
      },
    ] as never);
    await new RuleService(repo, "user").evaluate("audit");
    const secondRules = vi.mocked(repo.storeEvaluation).mock.calls[1]?.[2];
    expect(firstRules?.[0]?.snapshot).toMatchObject({ ruleVersion: 1 });
    expect(secondRules?.[0]?.snapshot).toMatchObject({ ruleVersion: 2, weight: 7 });
    expect(vi.mocked(repo.storeEvaluation).mock.calls[0]?.[4]).not.toEqual(
      vi.mocked(repo.storeEvaluation).mock.calls[1]?.[4],
    );
  });
});
