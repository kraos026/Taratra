import { describe, expect, it } from "vitest";
import { RuleEngine } from "./rule-engine";
const base = {
  version: 1,
  name: "Demo",
  categoryId: "demo",
  categoryCode: "demo",
  priority: 1,
  severity: "medium",
  weight: 1,
  result: {},
};
describe("published questionnaire demo rules", () => {
  it("matches realistic published-questionnaire answers", () => {
    const rules = [
      {
        ...base,
        id: "crm",
        code: "CRM_ABSENT",
        condition: { fact: "sales.crm", operator: "equal" as const, value: false },
      },
      {
        ...base,
        id: "invoice",
        code: "MANUAL_INVOICING",
        condition: { fact: "finance.invoicing", operator: "equal" as const, value: false },
      },
      {
        ...base,
        id: "support",
        code: "EMAIL_ONLY_SUPPORT",
        condition: { fact: "support.channels", operator: "equal" as const, value: "email" },
      },
      {
        ...base,
        id: "admin",
        code: "HIGH_REPETITIVE_TASKS",
        condition: { fact: "admin.hours", operator: "greaterThan" as const, value: 20 },
      },
    ];
    const result = new RuleEngine().evaluate(
      {
        "sales.crm": false,
        "finance.invoicing": false,
        "support.channels": "email",
        "admin.hours": 32,
      },
      rules,
    );
    expect(result.matched.map((item) => item.code)).toEqual([
      "CRM_ABSENT",
      "MANUAL_INVOICING",
      "EMAIL_ONLY_SUPPORT",
      "HIGH_REPETITIVE_TASKS",
    ]);
  });
});
