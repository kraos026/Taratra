import { describe, expect, it } from "vitest";
import { evaluateRules } from "./evaluate-rules";
import type { BusinessRule } from "../domain/rule";

describe("evaluateRules", () => {
  it("returns only deterministic matches", () => {
    const match: BusinessRule = {
      id: "approved-rule",
      version: 1,
      evaluate: () => ({
        ruleId: "approved-rule",
        recommendationId: "approved-recommendation",
        evidence: ["answer:a"],
      }),
    };
    const miss: BusinessRule = { id: "miss", version: 1, evaluate: () => null };
    expect(evaluateRules({ sectorId: "test", answers: {} }, [match, miss])).toHaveLength(1);
  });
});
