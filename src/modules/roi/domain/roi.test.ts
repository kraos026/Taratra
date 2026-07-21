import { describe, expect, it } from "vitest";
import { projectRoi } from "./roi";

describe("projectRoi", () => {
  it("keeps all assumptions visible in the result", () => {
    const assumptions = { hoursPerMonth: 100, hourlyCost: 30, automationRate: .5, monthlyOperatingCost: 200, implementationCost: 2600 };
    expect(projectRoi(assumptions)).toEqual({ monthlyGrossSavings: 1500, monthlyNetSavings: 1300, annualNetSavings: 15600, paybackMonths: 2, assumptions });
  });
  it("rejects unsupported rates", () => expect(() => projectRoi({ hoursPerMonth: 1, hourlyCost: 1, automationRate: 2, monthlyOperatingCost: 0, implementationCost: 0 })).toThrow());
});
