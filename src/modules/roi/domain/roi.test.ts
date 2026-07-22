import { describe, expect, it } from "vitest";
import { RoiEngine } from "./roi";
describe("RoiEngine", () => {
  const engine = new RoiEngine();
  it("calculates the documented formulas", () =>
    expect(engine.calculate({ hoursMonth: 10, hourlyCost: 50, implementationCost: 2000 })).toEqual({
      hoursYear: 120,
      annualSavings: 6000,
      roiPercentage: 200,
      paybackMonths: 4,
    }));
  it("supports negative ROI", () =>
    expect(
      engine.calculate({ hoursMonth: 1, hourlyCost: 10, implementationCost: 1000 }).roiPercentage,
    ).toBe(-88));
  it("supports zero ROI", () =>
    expect(
      engine.calculate({ hoursMonth: 10, hourlyCost: 10, implementationCost: 1200 }).roiPercentage,
    ).toBe(0));
  it("has no payback without savings", () =>
    expect(
      engine.calculate({ hoursMonth: 0, hourlyCost: 50, implementationCost: 100 }).paybackMonths,
    ).toBeNull());
  it("rejects negative values", () =>
    expect(() =>
      engine.calculate({ hoursMonth: -1, hourlyCost: 1, implementationCost: 1 }),
    ).toThrow());
  it("uses additional savings", () =>
    expect(
      engine.calculate({
        hoursMonth: 0,
        hourlyCost: 1,
        implementationCost: 100,
        additionalAnnualSavings: 200,
      }).roiPercentage,
    ).toBe(100));
});
