import { describe, expect, it } from "vitest";
import { evaluateCondition, evaluateOperator } from "./rule-condition";
import type { RuleOperator } from "./rule";

describe("evaluateOperator", () => {
  const cases: Array<[RuleOperator, unknown, unknown, boolean]> = [
    ["equal", "yes", "yes", true],
    ["notEqual", 1, 2, true],
    ["greaterThan", 3, 2, true],
    ["greaterOrEqual", 2, 2, true],
    ["lessThan", 1, 2, true],
    ["lessOrEqual", 2, 2, true],
    ["contains", ["email", "phone"], "email", true],
    ["notContains", "automatex", "paper", true],
    ["in", "manual", ["manual", "hybrid"], true],
    ["notIn", "automatic", ["manual", "hybrid"], true],
    ["isEmpty", [], undefined, true],
    ["isNotEmpty", false, undefined, true],
  ];
  it.each(cases)("evaluates %s", (operator, fact, expected, result) => {
    expect(evaluateOperator(operator, fact as never, expected as never)).toBe(result);
  });
});

describe("evaluateCondition", () => {
  const facts = { crm: false, employees: 25, channels: ["email"] };
  it("requires every all child", () =>
    expect(
      evaluateCondition(
        {
          all: [
            { fact: "crm", operator: "equal", value: false },
            { fact: "employees", operator: "greaterThan", value: 20 },
          ],
        },
        facts,
      ),
    ).toBe(true));
  it("requires one any child", () =>
    expect(
      evaluateCondition(
        {
          any: [
            { fact: "crm", operator: "equal", value: true },
            { fact: "employees", operator: "greaterThan", value: 20 },
          ],
        },
        facts,
      ),
    ).toBe(true));
  it("requires no none child", () =>
    expect(
      evaluateCondition(
        {
          none: [
            { fact: "crm", operator: "equal", value: true },
            { fact: "employees", operator: "lessThan", value: 5 },
          ],
        },
        facts,
      ),
    ).toBe(true));
});
