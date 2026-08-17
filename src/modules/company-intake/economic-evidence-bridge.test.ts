import { describe, expect, it } from "vitest";
import {
  RealCompanyEconomicEvidenceAssembler,
  type RealCompanyEconomicEvidenceInput,
} from "./index";
import type { EnterpriseEvidenceRecord } from "../../brain-evaluation/convergence-adapters";

const record = (
  id: string,
  rows: readonly Record<string, unknown>[],
  companyId = "company-a",
): EnterpriseEvidenceRecord => ({
  id,
  sourceType: "SYSTEM_RECORD",
  sourceReference: `system://${id}`,
  sourceModule: "enterprise_knowledge",
  capturedAt: new Date("2026-01-01T00:00:00Z"),
  reliability: 0.9,
  content: JSON.stringify(rows),
  structuredValue: { columns: ["concept", "value", "unit", "currency"], rows },
  provenance: { tenantId: "tenant-a", companyId, sourceId: id, sourceVersion: 1 },
  tenantId: "tenant-a",
  companyId,
});

const input = (
  evidence: readonly EnterpriseEvidenceRecord[],
): RealCompanyEconomicEvidenceInput => ({
  tenantId: "tenant-a",
  companyId: "company-a",
  knowledgeSnapshotId: "snapshot-1",
  opportunityId: "opportunity-1",
  evidence,
});

describe("live economic evidence bridge", () => {
  it("assembles structured production evidence and runs the existing Brain economic path", () => {
    const result = new RealCompanyEconomicEvidenceAssembler().assemble(
      input([
        record("erp-1", [
          { concept: "monthly_volume", value: 12500, unit: "transactions/month" },
          { concept: "task_frequency", value: 12, unit: "periods/year" },
          { concept: "task_duration", value: 30, unit: "minutes" },
          { concept: "labor_cost", value: 25, unit: "EUR/hour", currency: "EUR" },
          { concept: "implementation_cost", value: 10000, unit: "EUR", currency: "EUR" },
          { concept: "expected_time_reduction", value: 0.5, unit: "ratio" },
          { concept: "expected_automation_coverage", value: 0.8, unit: "ratio" },
          { concept: "expected_adoption_rate", value: 0.9, unit: "ratio" },
        ]),
      ]),
    );
    expect(result.values).toHaveLength(8);
    expect(result.values.find((value) => value.concept === "TASK_DURATION")?.value).toBe(0.5);
    expect(result.input.inputs.volume?.supportingEvidenceIds).toEqual(["erp-1"]);
    expect(result.qualification.reasoningTrace.backward("opportunity-1").length).toBeGreaterThan(0);
  });

  it("returns exact economic gaps and discovery targets instead of inventing ROI", () => {
    const result = new RealCompanyEconomicEvidenceAssembler().assemble(
      input([
        record("manager-1", [
          {
            concept: "monthly_volume",
            value: 1000,
            unit: "transactions/month",
            classification: "ASSUMED",
          },
        ]),
      ]),
    );
    expect(result.state).toBe("NEED_MORE_EVIDENCE");
    expect(result.gaps).toEqual(
      expect.arrayContaining(["frequency", "currentLaborTime", "laborCost", "implementationCost"]),
    );
    expect(
      result.discoveryTargets.some((target) => target.preferredSource === "FINANCE_INTERVIEW"),
    ).toBe(true);
    expect(result.productionRoiInput.qualificationState).toBe("NEED_MORE_EVIDENCE");
  });

  it("retains conflicting ERP and manager values and blocks material economics", () => {
    const result = new RealCompanyEconomicEvidenceAssembler().assemble(
      input([
        record("erp-1", [{ concept: "monthly_volume", value: 7800, unit: "transactions/month" }]),
        record("manager-1", [
          {
            concept: "monthly_volume",
            value: 10000,
            unit: "transactions/month",
            classification: "ASSUMED",
          },
        ]),
      ]),
    );
    expect(result.values.filter((value) => value.concept === "TRANSACTION_VOLUME")).toHaveLength(2);
    expect(result.qualification.contradictions).toContain("MATERIAL_ECONOMIC_CONTRADICTION");
    expect(result.eligibility.eligibility).toBe("BLOCKED");
  });

  it("rejects cross-company evidence before economic reasoning", () => {
    expect(() =>
      new RealCompanyEconomicEvidenceAssembler().assemble(
        input([
          record("other", [{ concept: "labor_cost", value: 40, unit: "EUR/hour" }], "company-b"),
        ]),
      ),
    ).toThrow("scope mismatch");
  });

  it("requires explicit currency normalization for multiple currencies", () => {
    const result = new RealCompanyEconomicEvidenceAssembler().assemble(
      input([
        record("costs", [
          { concept: "labor_cost", value: 25, unit: "EUR/hour", currency: "EUR" },
          { concept: "implementation_cost", value: 10000, unit: "USD", currency: "USD" },
        ]),
      ]),
    );
    expect(result.state).toBe("CURRENCY_NORMALIZATION_REQUIRED");
    expect(result.currencies).toEqual(["EUR", "USD"]);
  });

  it("preserves negative economics as a non-recommendation", () => {
    const result = new RealCompanyEconomicEvidenceAssembler().assemble(
      input([
        record("negative", [
          { concept: "monthly_volume", value: 1, unit: "transactions/month" },
          { concept: "task_frequency", value: 12, unit: "periods/year" },
          { concept: "task_duration", value: 1, unit: "hours" },
          { concept: "labor_cost", value: 1, unit: "EUR/hour", currency: "EUR" },
          { concept: "implementation_cost", value: 1000000, unit: "EUR", currency: "EUR" },
          { concept: "maintenance_cost", value: 1000000, unit: "EUR/year", currency: "EUR" },
          { concept: "expected_time_reduction", value: 1, unit: "ratio" },
          { concept: "expected_automation_coverage", value: 1, unit: "ratio" },
          { concept: "expected_adoption_rate", value: 1, unit: "ratio" },
        ]),
      ]),
    );
    expect(result.state).toBe("ECONOMICALLY_UNQUALIFIED");
    expect(result.qualification.economicSignal).toBe("NEGATIVE_VALUE");
  });
});
