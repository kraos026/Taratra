import { describe, expect, it } from "vitest";
import {
  parseSyntheticExpressionEnvelope,
  SyntheticExpressionParseError,
} from "./synthetic-expression-contract";

const valid = JSON.stringify({
  expressionId: "e-1",
  task: "INTERVIEW",
  content: "I think the ERP is slow.",
  language: "en",
  speakerRole: "MANAGER",
  claims: ["ERP is slow"],
  unknowns: ["root cause"],
  terminology: {},
  warnings: [],
});

describe("SyntheticExpressionEnvelope", () => {
  it("parses a valid bounded expression", () => {
    expect(parseSyntheticExpressionEnvelope(valid, "MANAGER").content).toContain("ERP");
  });
  it("rejects empty content and reasoning-only responses", () => {
    expect(() => parseSyntheticExpressionEnvelope("", "MANAGER")).toThrow(/empty/i);
    expect(() =>
      parseSyntheticExpressionEnvelope(
        JSON.stringify({ reasoning_content: "private reasoning" }),
        "MANAGER",
      ),
    ).toThrow(/schema/i);
  });
  it("distinguishes invalid JSON and schema mismatch", () => {
    expect(() => parseSyntheticExpressionEnvelope("not-json")).toThrow(/invalid/i);
    expect(() =>
      parseSyntheticExpressionEnvelope(JSON.stringify({ ...JSON.parse(valid), content: "" })),
    ).toThrowError(SyntheticExpressionParseError);
  });
  it("rejects a wrong speaker role without changing the expression", () => {
    expect(() => parseSyntheticExpressionEnvelope(valid, "OPERATOR")).toThrow(/speaker role/i);
  });
  it("keeps claims and unknowns as non-authoritative hints", () => {
    const envelope = parseSyntheticExpressionEnvelope(valid);
    expect(envelope.claims).toEqual(["ERP is slow"]);
    expect(envelope.unknowns).toEqual(["root cause"]);
  });

  it("rejects unexpected properties and enum mismatches", () => {
    expect(() =>
      parseSyntheticExpressionEnvelope(JSON.stringify({ ...JSON.parse(valid), extra: true })),
    ).toThrow(/schema/i);
    expect(() =>
      parseSyntheticExpressionEnvelope(
        JSON.stringify({ ...JSON.parse(valid), task: "process_observation" }),
      ),
    ).toThrow(/schema/i);
  });
});
