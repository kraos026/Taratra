import { describe, expect, it } from "vitest";
import { RuleEngine } from "./rule-engine";
const metadata = { version: 1, name: "Rule", priority: 10, severity: "medium" };
const rules = [
  {
    ...metadata,
    id: "one",
    code: "ONE",
    categoryId: "sales",
    categoryCode: "sales",
    weight: 3,
    condition: { fact: "crm", operator: "equal" as const, value: false },
    result: {},
  },
  {
    ...metadata,
    id: "two",
    code: "TWO",
    categoryId: "sales",
    categoryCode: "sales",
    weight: 1,
    condition: { fact: "employees", operator: "greaterThan" as const, value: 50 },
    result: {},
  },
  {
    ...metadata,
    id: "three",
    code: "THREE",
    categoryId: "security",
    categoryCode: "security",
    weight: 4,
    condition: { fact: "backup", operator: "equal" as const, value: false },
    result: {},
  },
];
describe("RuleEngine", () => {
  it("returns true and false rules deterministically", () => {
    const result = new RuleEngine().evaluate({ crm: false, employees: 20, backup: true }, rules);
    expect(result.matched.map((rule) => rule.code)).toEqual(["ONE"]);
    expect(result.unmatched.map((rule) => rule.code)).toEqual(["TWO", "THREE"]);
  });
  it("calculates category and global weighted scores", () => {
    const result = new RuleEngine().evaluate({ crm: false, employees: 20, backup: false }, rules);
    expect(result.scores).toEqual([
      { categoryId: "sales", categoryCode: "sales", score: 3, total: 4, percentage: 75 },
      { categoryId: "security", categoryCode: "security", score: 4, total: 4, percentage: 100 },
      { categoryId: null, categoryCode: "global", score: 7, total: 8, percentage: 87.5 },
    ]);
  });
  it("stores a self-contained snapshot with only referenced facts", () => {
    const result = new RuleEngine().evaluate({ crm: false, ignored: "secret" }, [rules[0]!]);
    expect(result.matched[0]?.snapshot).toMatchObject({
      ruleId: "one",
      ruleCode: "ONE",
      ruleVersion: 1,
      categoryCode: "sales",
      conditionJson: { fact: "crm", operator: "equal", value: false },
      matched: true,
      score: 3,
      facts: { crm: false },
    });
    expect(result.matched[0]?.snapshot).not.toHaveProperty("facts.ignored");
  });
  it("is idempotent with identical facts and rules", () => {
    const engine = new RuleEngine();
    expect(engine.evaluate({ crm: false }, [rules[0]!])).toEqual(
      engine.evaluate({ crm: false }, [rules[0]!]),
    );
  });
});
