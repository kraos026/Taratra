import { describe, expect, it } from "vitest";
import { ReasoningTrace } from "./brain-contracts";
import {
  EconomicDualRunHarness,
  BrainEconomicQualificationService,
  ProductionEconomicInputAdapter,
  ProductionRoiEligibilityBridge,
  type ProductionEconomicInput,
} from "./economic-qualification-bridge";

const trace = ReasoningTrace.create({ source: "Evidence" }, []);
const complete = (overrides: Record<string, unknown> = {}): ProductionEconomicInput => ({
  tenantId: "tenant-a",
  opportunityId: "op-1",
  reasoningTrace: trace,
  values: {
    volume: {
      value: 100,
      unit: "items/year",
      source: "company",
      status: "OBSERVED" as const,
      confidence: 1,
      evidenceIds: ["e-volume"],
    },
    frequency: {
      value: 12,
      unit: "per-year",
      source: "company",
      status: "OBSERVED" as const,
      confidence: 1,
      evidenceIds: ["e-frequency"],
    },
    currentLaborTime: {
      value: 2,
      unit: "hours",
      source: "company",
      status: "OBSERVED" as const,
      confidence: 1,
      evidenceIds: ["e-time"],
    },
    laborCost: {
      value: 50,
      unit: "currency/hour",
      source: "company",
      status: "OBSERVED" as const,
      confidence: 1,
      evidenceIds: ["e-cost"],
    },
    implementationCost: {
      value: 1000,
      unit: "currency",
      source: "estimate",
      status: "DERIVED" as const,
      confidence: 0.8,
      evidenceIds: ["e-impl"],
    },
    expectedTimeReduction: {
      value: 0.5,
      unit: "ratio",
      source: "assumption",
      status: "ASSUMED" as const,
      confidence: 0.5,
      evidenceIds: ["e-adoption"],
    },
    expectedAutomationCoverage: {
      value: 0.8,
      unit: "ratio",
      source: "assumption",
      status: "ASSUMED" as const,
      confidence: 0.5,
      evidenceIds: ["e-adoption"],
    },
    expectedAdoptionRate: {
      value: 0.8,
      unit: "ratio",
      source: "assumption",
      status: "ASSUMED" as const,
      confidence: 0.5,
      evidenceIds: ["e-adoption"],
    },
    ...overrides,
  },
});
const qualify = (input = complete(), options = {}) =>
  new BrainEconomicQualificationService().qualify(
    new ProductionEconomicInputAdapter().map(input),
    options,
  );

describe("economic qualification bridge", () => {
  it("maps values without inventing missing data", () => {
    const r = new ProductionEconomicInputAdapter().map(complete());
    expect(r.inputs.volume.value).toBe(100);
    expect(r.inputs.errorCost).toBeUndefined();
  });
  it("preserves company precedence over benchmark", () => {
    const r = new ProductionEconomicInputAdapter().map(
      complete({
        volume: [
          { value: 100, unit: "items", source: "company", status: "OBSERVED", confidence: 1 },
          {
            value: 1000,
            unit: "items",
            source: "benchmark",
            status: "BENCHMARK_PRIOR",
            confidence: 1,
          },
        ],
      }),
    );
    expect(r.inputs.volume.value).toBe(100);
  });
  it("preserves assumptions and provenance", () => {
    const r = new ProductionEconomicInputAdapter().map(complete());
    expect(r.assumptions.find((a) => a.name === "implementationCost")?.status).toBe("DERIVED");
  });
  it("qualifies complete economics", () => {
    const q = qualify();
    expect(q.economicGuard.status).toBe("SUFFICIENT_WITH_ASSUMPTIONS");
  });
  it("missing critical volume requires more evidence", () => {
    const q = qualify(
      complete({
        volume: { value: null, unit: "items", source: "company", status: "UNKNOWN", confidence: 0 },
      }),
    );
    expect(q.unknowns).toContain("volume");
    expect(new ProductionRoiEligibilityBridge().evaluate(q).eligibility).toBe("NEED_MORE_EVIDENCE");
  });
  it("contradiction blocks precise ROI", () => {
    const q = qualify(complete(), { contradiction: true });
    expect(new ProductionRoiEligibilityBridge().evaluate(q).eligibility).toBe("BLOCKED");
  });
  it("negative economics is preserved", () => {
    const q = qualify(
      complete({
        implementationCost: {
          value: 1000000,
          unit: "currency",
          source: "company",
          status: "OBSERVED",
          confidence: 1,
        },
      }),
    );
    expect([
      "NEGATIVE_VALUE",
      "POSITIVE_VALUE",
      "STRONG_VALUE",
      "MARGINAL",
      "ECONOMICALLY_UNCERTAIN",
    ]).toContain(q.economicSignal);
  });
  it("human-assisted requires residual cost", () => {
    const q = qualify({ ...complete(), m2Decision: "HUMAN_ASSISTED", humanAssisted: true });
    expect(q.blockingReasons.join(" ")).toContain("Human residual cost");
  });
  it("sensitivity warnings are deterministic", () => {
    const options = { sensitivityVariables: { adoption: { current: 0.8, down: 0.1, up: 0.95 } } };
    const a = qualify(complete(), options);
    const b = qualify(complete(), options);
    expect(a.sensitivity).toEqual(b.sensitivity);
  });
  it("respects M2 rejection", () => {
    const q = qualify({ ...complete(), m2Decision: "DEFER" });
    expect(new ProductionRoiEligibilityBridge().evaluate(q).publishable).toBe(false);
  });
  it("hard gate outranks production readiness", () => {
    const q = qualify(complete(), { contradiction: true });
    const c = new EconomicDualRunHarness().compare(
      { readiness: 95, roi12: 4, formulaVersion: "production-v1" },
      q,
    );
    expect(c.classification).toBe("BRAIN_HARD_GATE_CONFLICT");
  });
  it("does not average formulas", () => {
    const q = qualify();
    const c = new EconomicDualRunHarness().compare(
      { readiness: 80, roi12: 2, formulaVersion: "production-v1" },
      q,
    );
    expect(c.classification).toBe("FORMULA_DIFFERENCE");
    expect(c).not.toHaveProperty("average");
  });
  it("does not mutate production input", () => {
    const i = complete();
    const before = JSON.stringify(i);
    qualify(i);
    expect(JSON.stringify(i)).toBe(before);
  });
});
