import { describe, expect, it } from "vitest";
import { calculateProgress, evaluateCompletion } from "./progress";
describe("calculateProgress", () => {
  it("returns zero without questions", () => expect(calculateProgress(0, 0)).toBe(0));
  it("rounds to nearest integer", () => expect(calculateProgress(3, 2)).toBe(67));
  it("caps progress at 100", () => expect(calculateProgress(2, 3)).toBe(100));
});
describe("evaluateCompletion", () => {
  it("completes at partial progress when only optional questions remain", () => {
    expect(
      evaluateCompletion(["required", "optional"], ["required"], new Set(["required"])),
    ).toEqual({
      canComplete: true,
      progress: 50,
    });
  });
  it("reaches 100 only when every question is answered", () => {
    expect(
      evaluateCompletion(["required", "optional"], ["required"], new Set(["required", "optional"])),
    ).toEqual({ canComplete: true, progress: 100 });
  });
  it("keeps an empty questionnaire at zero", () => {
    expect(evaluateCompletion([], [], new Set())).toEqual({ canComplete: true, progress: 0 });
  });
});
