import { describe, expect, it } from "vitest";
import { AutomationSpecificationAggregate } from "./automation-specification-aggregate";

const state = {
  id: "specification",
  status: "draft" as const,
  lockVersion: 2,
  versionNumber: 1,
  isLatestVersion: true,
  validations: [
    {
      ruleCode: "valid",
      ruleVersion: 1,
      severity: "error" as const,
      passed: true,
      targetLocalId: null,
      message: "valid",
      details: {},
    },
  ],
};

describe("AutomationSpecificationAggregate", () => {
  it("prepares a new immutable version on rebuild", () => {
    expect(AutomationSpecificationAggregate.rehydrate(state).prepareRebuild(2)).toEqual({
      previousVersionId: "specification",
      versionNumber: 2,
    });
  });

  it("rejects a stale lock", () => {
    expect(() => AutomationSpecificationAggregate.rehydrate(state).validate(1)).toThrow(
      "modified concurrently",
    );
  });

  it("rejects a transition of a superseded version", () => {
    expect(() =>
      AutomationSpecificationAggregate.rehydrate({ ...state, isLatestVersion: false }).validate(2),
    ).toThrow("lifecycle invariant");
  });

  it("rejects validation when an error rule failed", () => {
    expect(() =>
      AutomationSpecificationAggregate.rehydrate({
        ...state,
        validations: [{ ...state.validations[0], passed: false }],
      }).validate(2),
    ).toThrow("lifecycle invariant");
  });

  it("rejects draft to validated when no catalog validation was evaluated", () => {
    expect(() =>
      AutomationSpecificationAggregate.rehydrate({ ...state, validations: [] }).validate(2),
    ).toThrow("lifecycle invariant");
  });

  it("allows validated to published with complete passing validations", () => {
    expect(
      AutomationSpecificationAggregate.rehydrate({
        ...state,
        status: "validated",
      }).publish(2),
    ).toEqual({ from: "validated", to: "published" });
  });

  it("allows owner-authorized application flow to archive a non-archived snapshot", () => {
    expect(AutomationSpecificationAggregate.rehydrate(state).archive(2)).toEqual({
      from: "draft",
      to: "archived",
    });
  });

  it("rejects archiving a superseded version before PostgreSQL is called", () => {
    expect(() =>
      AutomationSpecificationAggregate.rehydrate({
        ...state,
        status: "published",
        isLatestVersion: false,
      }).archive(2),
    ).toThrow("lifecycle invariant");
  });
});
