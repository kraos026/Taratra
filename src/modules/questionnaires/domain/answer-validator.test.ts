import { describe, expect, it } from "vitest";
import { validateAnswer } from "./answer-validator";
const q = (questionType: Parameters<typeof validateAnswer>[0]["questionType"], extra = {}) => ({
  questionType,
  ...extra,
});
describe("validateAnswer", () => {
  it.each([
    ["short_text", "ok"],
    ["long_text", "text"],
    ["number", 2],
    ["boolean", true],
    ["percentage", 50],
    ["currency", 0],
    ["date", "2026-07-22"],
  ] as const)("validates %s", (type, value) =>
    expect(validateAnswer(q(type), value)).toEqual(value),
  );
  it("validates choice options", () => {
    expect(validateAnswer(q("single_choice", { optionsJson: ["a"] }), "a")).toBe("a");
    expect(validateAnswer(q("multiple_choice", { optionsJson: ["a", "b"] }), ["a", "a"])).toEqual([
      "a",
    ]);
    expect(() => validateAnswer(q("single_choice", { optionsJson: ["a"] }), "b")).toThrow(
      "allowed option",
    );
  });
  it("applies numeric and length rules", () => {
    expect(() => validateAnswer(q("number", { validationJson: { min: 2 } }), 1)).toThrow(
      "at least",
    );
    expect(() =>
      validateAnswer(q("short_text", { validationJson: { minLength: 3 } }), "ab"),
    ).toThrow("characters");
  });
  it("rejects invalid built-in ranges and types", () => {
    expect(() => validateAnswer(q("percentage"), 101)).toThrow();
    expect(() => validateAnswer(q("currency"), -1)).toThrow();
    expect(() => validateAnswer(q("date"), "nope")).toThrow();
  });
});
