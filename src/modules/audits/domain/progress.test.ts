import { describe, expect, it } from "vitest";
import { calculateProgress } from "./progress";
describe("calculateProgress", () => {
  it("returns zero without questions", () => expect(calculateProgress(0, 0)).toBe(0));
  it("rounds to nearest integer", () => expect(calculateProgress(3, 2)).toBe(67));
  it("caps progress at 100", () => expect(calculateProgress(2, 3)).toBe(100));
});
