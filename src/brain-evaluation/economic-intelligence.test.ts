import { describe, expect, it } from "vitest";
import {
  EconomicInputFactory,
  BaselineEconomicModel,
  TransformationCostModel,
  BenefitModel,
  EconomicEvaluation,
  EconomicEvidenceGuard,
  ScenarioEvaluator,
  SensitivityAnalyzer,
  BreakEvenAnalyzer,
  CostOfInaction,
  TimeToValueEstimate,
  RiskAdjustedValue,
} from "./economic-intelligence";
const obs = (name: string, value: number | null) =>
  EconomicInputFactory.create(
    name,
    value,
    "unit",
    value === null ? "UNKNOWN" : "OBSERVED",
    "company",
    value === null ? 0 : 1,
  );
const inputs = () =>
  Object.fromEntries(
    [
      obs("currentLaborTime", 10),
      obs("laborCost", 20),
      obs("frequency", 250),
      obs("volume", 100),
      obs("errorRate", 0.1),
      obs("errorCost", 30),
      obs("delayCost", 5),
      obs("implementationCost", 1000),
      obs("integrationCost", 500),
      obs("expectedTimeReduction", 0.5),
      obs("expectedAutomationCoverage", 0.8),
      obs("expectedAdoptionRate", 0.8),
      obs("expectedErrorReduction", 0.5),
      obs("recurringCost", 100),
      obs("maintenanceCost", 50),
    ].map((x) => [x.name, x]),
  );
describe("B2.6 economic intelligence", () => {
  it("is deterministic and computes baseline/cost/benefit", () => {
    const i = inputs();
    const base = new BaselineEconomicModel().calculate(i);
    const cost = new TransformationCostModel().calculate(i);
    const benefit = new BenefitModel().calculate(i);
    expect(base).toEqual(new BaselineEconomicModel().calculate(i));
    expect(cost.totalInitial).toBe(1500);
    expect(benefit.annualBenefit).not.toBeNull();
  });
  it("never invents missing values", () => {
    const base = new BaselineEconomicModel().calculate({
      volume: obs("volume", null),
      laborCost: obs("laborCost", 20),
    });
    expect(base.missingInputs).toContain("volume");
    expect(base.annualLaborCost).toBeNull();
  });
  it("blocks incomplete economic evaluation", () => {
    const i = inputs();
    const result = new EconomicEvaluation().evaluate(
      new BenefitModel().calculate(i),
      new TransformationCostModel().calculate(i),
      0.8,
      ["volume"],
    );
    expect(result.status).toBe("NEED_MORE_EVIDENCE");
  });
  it("keeps benchmark assumptions disclosed", () =>
    expect(
      new EconomicEvidenceGuard().assess([
        EconomicInputFactory.create("x", 10, "u", "BENCHMARK_PRIOR", "benchmark", 0.5),
      ]).status,
    ).toBe("SUFFICIENT_WITH_ASSUMPTIONS"));
  it("preserves scenarios, sensitivity and break-even", () => {
    const base = new EconomicEvaluation().evaluate(
      new BenefitModel().calculate(inputs()),
      new TransformationCostModel().calculate(inputs()),
      0.9,
      [],
    );
    expect(
      new ScenarioEvaluator().evaluate(base, {
        kind: "PESSIMISTIC",
        adoption: 0.4,
        coverage: 0.5,
        volumeMultiplier: 0.7,
        errorReduction: 0.2,
        implementationMultiplier: 2,
        maintenanceMultiplier: 2,
        growth: 0,
        failureRate: 0.1,
      }).netAnnualBenefit,
    ).toBeLessThan(base.netAnnualBenefit!);
    expect(
      new SensitivityAnalyzer().analyze(base, { adoption: { current: 0.8, down: 0.3, up: 1 } })[0]!
        .variable,
    ).toBe("adoption");
    expect(new BreakEvenAnalyzer().minimumAdoption(100, 50)).toBe(0.5);
  });
  it("separates cost of inaction and time-to-value", () => {
    const inaction = new CostOfInaction().calculate({
      currentAnnualWaste: obs("currentAnnualWaste", 100),
      expectedGrowthRate: obs("expectedGrowthRate", 0.1),
    });
    expect(inaction.annualWaste).toBe(100);
    expect(
      new TimeToValueEstimate().estimate({
        implementationMonths: 1,
        integrationMonths: 1,
        trainingMonths: 1,
        adoptionRampMonths: 1,
        prerequisiteMonths: 1,
      }).maximumMonths,
    ).toBe(9);
  });
  it("exposes risk adjustment", () =>
    expect(
      new RiskAdjustedValue().assess(100, {
        operationalRisk: 0.2,
        dataRisk: 0.2,
        securityRisk: 0,
        complianceRisk: 0,
        financialRisk: 0,
        vendorDependencyRisk: 0,
        changeManagementRisk: 0,
      }).riskAdjustedBenefit,
    ).toBeCloseTo(94.285714, 5));
});
