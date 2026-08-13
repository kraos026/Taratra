import { describe, expect, it } from "vitest";
import { ReasoningTrace } from "./brain-contracts";
import {
  CustomerSimulationEngine,
  SimulationBreakpointAnalyzer,
  SolutionComparisonEngine,
  WhatIfEngine,
  type CustomerSimulationInput,
} from "./customer-simulation-core";

const makeInput = (extra: Partial<CustomerSimulationInput> = {}): CustomerSimulationInput => ({
  tenantId: "tenant-a",
  companyId: "company-a",
  processId: "process-1",
  opportunityId: "op-1",
  solutionId: "solution-a",
  modelVersion: "sim-v1",
  simulationHorizonMonths: 12,
  reasoningTrace: ReasoningTrace.create({ source: "evidence" }, []),
  values: {
    volume: { value: 1000, unit: "items", source: "company", status: "OBSERVED", confidence: 1 },
    processingTime: {
      value: 2,
      unit: "hours",
      source: "company",
      status: "OBSERVED",
      confidence: 1,
    },
    waitingTime: { value: 1, unit: "hours", source: "company", status: "OBSERVED", confidence: 1 },
    laborEffort: {
      value: 100,
      unit: "hours",
      source: "company",
      status: "OBSERVED",
      confidence: 1,
    },
    humanEffort: { value: 20, unit: "hours", source: "company", status: "OBSERVED", confidence: 1 },
    throughput: { value: 100, unit: "items", source: "company", status: "OBSERVED", confidence: 1 },
    capacity: { value: 120, unit: "items", source: "company", status: "OBSERVED", confidence: 1 },
    cost: { value: 10000, unit: "currency", source: "company", status: "OBSERVED", confidence: 1 },
    errorRate: { value: 0.1, unit: "ratio", source: "company", status: "OBSERVED", confidence: 1 },
    errorCost: {
      value: 10,
      unit: "currency",
      source: "company",
      status: "OBSERVED",
      confidence: 1,
    },
    automationCoverage: {
      value: 0.8,
      unit: "ratio",
      source: "assumption",
      status: "ASSUMED",
      confidence: 0.6,
    },
    expectedTimeReduction: {
      value: 0.5,
      unit: "ratio",
      source: "assumption",
      status: "ASSUMED",
      confidence: 0.6,
    },
    expectedErrorReduction: {
      value: 0.4,
      unit: "ratio",
      source: "assumption",
      status: "ASSUMED",
      confidence: 0.6,
    },
    expectedAdoption: {
      value: 0.7,
      unit: "ratio",
      source: "assumption",
      status: "ASSUMED",
      confidence: 0.6,
    },
    maintenanceCost: {
      value: 500,
      unit: "currency",
      source: "assumption",
      status: "ASSUMED",
      confidence: 0.6,
    },
  },
  ...extra,
});

describe("Customer simulation core", () => {
  it("is deterministic", () => {
    const e = new CustomerSimulationEngine();
    expect(e.simulate(makeInput())).toEqual(e.simulate(makeInput()));
  });
  it("keeps baseline unchanged", () => {
    const input = makeInput();
    const before = JSON.stringify(input.values);
    new CustomerSimulationEngine().simulate(input);
    expect(JSON.stringify(input.values)).toBe(before);
  });
  it("projects all declared scenarios", () => {
    const r = new CustomerSimulationEngine().simulate(makeInput());
    expect(r.base.scenario).toBe("BASE");
    expect(r.pessimistic.scenario).toBe("PESSIMISTIC");
    expect(r.optimistic.scenario).toBe("OPTIMISTIC");
    expect(r.stress.scenario).toBe("STRESS");
  });
  it("reduces labor and errors with adoption", () => {
    const r = new CustomerSimulationEngine().simulate(makeInput());
    expect(r.base.operationalImpact.laborRequirement).toBeLessThan(100);
    expect(r.base.operationalImpact.errorVolume).toBeLessThan(100);
  });
  it("preserves human residual work", () => {
    const r = new CustomerSimulationEngine().simulate(makeInput({ humanAssisted: true }));
    expect(r.base.operationalImpact.humanResidualWork).toBeGreaterThan(0);
    expect(r.warnings).toContain("Human residual work preserved");
  });
  it("preserves controls as warnings", () => {
    const r = new CustomerSimulationEngine().simulate(
      makeInput({ controls: ["financial approval"] }),
    );
    expect(r.base.warnings).toContain("Controls retained in simulation");
  });
  it("low adoption reduces benefit", () => {
    const normal = new CustomerSimulationEngine().simulate(makeInput());
    const low = new CustomerSimulationEngine().simulate(
      makeInput({
        values: {
          ...makeInput().values,
          expectedAdoption: {
            value: 0.2,
            unit: "ratio",
            source: "assumption",
            status: "ASSUMED",
            confidence: 0.6,
          },
        },
      }),
    );
    expect(low.base.economicProjection.netBenefit ?? 0).toBeLessThanOrEqual(
      normal.base.economicProjection.netBenefit ?? 0,
    );
  });
  it("unknown values remain explicit", () => {
    const r = new CustomerSimulationEngine().simulate(
      makeInput({
        values: {
          ...makeInput().values,
          volume: {
            value: null,
            unit: "items",
            source: "unknown",
            status: "UNKNOWN",
            confidence: 0,
          },
        },
      }),
    );
    expect(r.unknowns).toContain("volume");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("detects deterministic breakpoint", () => {
    const a = new SimulationBreakpointAnalyzer().findVolumeBreakpoint(makeInput());
    expect(a).toBe(1.2);
  });
  it("supports reproducible what-if", () => {
    const r = new WhatIfEngine().compare(makeInput(), { adoption: 0.3 });
    expect(r.result.base.parameters.adoption).toBe(0.3);
    expect(r).toEqual(new WhatIfEngine().compare(makeInput(), { adoption: 0.3 }));
  });
  it("compares solutions without deciding portfolio", () => {
    const e = new CustomerSimulationEngine();
    const a = e.simulate(makeInput());
    const b = e.simulate(makeInput({ solutionId: "solution-b" }));
    const c = new SolutionComparisonEngine().compare(a, b);
    expect(c).not.toHaveProperty("decision");
  });
  it("does not publish ROI or production artifacts", () => {
    const r = new CustomerSimulationEngine().simulate(makeInput());
    expect(r).not.toHaveProperty("published");
    expect(r).not.toHaveProperty("roiArtifact");
  });
  it("keeps simulation model version explicit", () => {
    expect(new CustomerSimulationEngine().simulate(makeInput()).simulationModelVersion).toBe(
      "sim-v1",
    );
  });
});
