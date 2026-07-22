import { describe, expect, it } from "vitest";
import { ruleConditionSchema, ruleInputSchema } from "./rule-schemas";
describe("ruleConditionSchema", () => {
  it("accepts nested deterministic conditions", () =>
    expect(
      ruleConditionSchema.safeParse({
        all: [
          { fact: "crm_used", operator: "equal", value: false },
          { none: [{ fact: "size", operator: "lessThan", value: 20 }] },
        ],
      }).success,
    ).toBe(true));
  it("rejects missing values and empty logical groups", () => {
    expect(ruleConditionSchema.safeParse({ fact: "size", operator: "greaterThan" }).success).toBe(
      false,
    );
    expect(ruleConditionSchema.safeParse({ any: [] }).success).toBe(false);
  });
  it("rejects code execution-shaped input", () =>
    expect(
      ruleConditionSchema.safeParse({ fact: "x", operator: "eval", value: "process.exit()" })
        .success,
    ).toBe(false));
});
describe("ruleInputSchema", () => {
  it("rejects an invalid rule payload", () =>
    expect(ruleInputSchema.safeParse({ code: "bad code", conditionJson: {} }).success).toBe(false));
});
