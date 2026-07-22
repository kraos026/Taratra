import { describe, expect, it } from "vitest";
import { RuleEngine } from "./rule-engine";
const rules = [
  {
    id: "one",
    code: "ONE",
    categoryId: "sales",
    categoryCode: "sales",
    weight: 3,
    condition: { fact: "crm", operator: "equal" as const, value: false },
    result: {},
  },
  {
    id: "two",
    code: "TWO",
    categoryId: "sales",
    categoryCode: "sales",
    weight: 1,
    condition: { fact: "employees", operator: "greaterThan" as const, value: 50 },
    result: {},
  },
  {
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
});
