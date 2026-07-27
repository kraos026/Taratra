import { describe, expect, it } from "vitest";
import { SolutionBlueprintAggregate } from "./solution-blueprint-aggregate";

const aggregate = (
  status: "draft" | "validated" | "published" = "draft",
  passed = true,
  evidenceCount = 1,
) =>
  SolutionBlueprintAggregate.rehydrate({
    id: "blueprint",
    status,
    lockVersion: 2,
    evidenceCount,
    validations: [
      {
        code: "catalog-rule",
        severity: "error",
        message: "catalog rule",
        passed,
      },
    ],
  });

describe("SolutionBlueprintAggregate", () => {
  it("allows only a valid draft to transition to validated", () => {
    expect(aggregate().validate(2)).toEqual({ from: "draft", to: "validated" });
    expect(() => aggregate("draft", false).validate(2)).toThrow();
  });

  it("allows only an evidenced validated blueprint to publish", () => {
    expect(aggregate("validated").publish(2)).toEqual({
      from: "validated",
      to: "published",
    });
    expect(() => aggregate("validated", true, 0).publish(2)).toThrow();
  });

  it("rejects stale lock versions", () => {
    expect(() => aggregate().prepareRebuild(1)).toThrow();
  });
});
