export type RoiInput = {
  hoursMonth: number;
  hourlyCost: number;
  implementationCost: number;
  additionalAnnualSavings?: number;
};
export type RoiResult = {
  hoursYear: number;
  annualSavings: number;
  roiPercentage: number;
  paybackMonths: number | null;
};

export class RoiEngine {
  calculate(input: RoiInput): RoiResult {
    if (
      Object.values(input).some(
        (value) => value !== undefined && (!Number.isFinite(value) || value < 0),
      )
    )
      throw new Error("ROI inputs must be finite and non-negative");
    const hoursYear = input.hoursMonth * 12;
    const annualSavings = hoursYear * input.hourlyCost + (input.additionalAnnualSavings ?? 0);
    const roiPercentage =
      input.implementationCost === 0
        ? annualSavings > 0
          ? Number.POSITIVE_INFINITY
          : 0
        : ((annualSavings - input.implementationCost) / input.implementationCost) * 100;
    const monthlySavings =
      input.hoursMonth * input.hourlyCost + (input.additionalAnnualSavings ?? 0) / 12;
    const paybackMonths = monthlySavings > 0 ? input.implementationCost / monthlySavings : null;
    return { hoursYear, annualSavings, roiPercentage, paybackMonths };
  }
}
