export interface RoiAssumptions {
  readonly hoursPerMonth: number;
  readonly hourlyCost: number;
  readonly automationRate: number;
  readonly monthlyOperatingCost: number;
  readonly implementationCost: number;
}

export interface RoiProjection {
  readonly monthlyGrossSavings: number;
  readonly monthlyNetSavings: number;
  readonly annualNetSavings: number;
  readonly paybackMonths: number | null;
  readonly assumptions: RoiAssumptions;
}

export function projectRoi(a: RoiAssumptions): RoiProjection {
  if (
    [a.hoursPerMonth, a.hourlyCost, a.monthlyOperatingCost, a.implementationCost].some(
      (v) => v < 0,
    ) ||
    a.automationRate < 0 ||
    a.automationRate > 1
  ) {
    throw new Error("Invalid ROI assumptions");
  }
  const monthlyGrossSavings = a.hoursPerMonth * a.hourlyCost * a.automationRate;
  const monthlyNetSavings = monthlyGrossSavings - a.monthlyOperatingCost;
  return {
    monthlyGrossSavings,
    monthlyNetSavings,
    annualNetSavings: monthlyNetSavings * 12,
    paybackMonths: monthlyNetSavings > 0 ? a.implementationCost / monthlyNetSavings : null,
    assumptions: a,
  };
}
