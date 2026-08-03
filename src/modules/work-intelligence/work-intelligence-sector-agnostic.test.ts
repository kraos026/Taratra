import { describe, expect, it } from "vitest";

import {
  WorkAutomationHypothesisEngine,
  DeterministicActivityNormalizer,
  qualifyAutomationCandidate,
  estimateTimeSavings,
  WorkActivity,
  WorkPatternEngine,
} from "./domain/work-intelligence";

const sectors = [
  {
    sector: "e-commerce",
    description: "Update product record",
    code: "ORDER_CATALOG_MAINTENANCE",
    category: "Operations",
    tools: ["commerce-system", "spreadsheet"],
  },
  {
    sector: "accounting",
    description: "Reconcile ledger entries",
    code: "LEDGER_RECONCILIATION",
    category: "Finance",
    tools: ["ledger-system"],
  },
  {
    sector: "hospitality",
    description: "Record room turnover",
    code: "ROOM_TURNOVER_RECORDING",
    category: "Operations",
    tools: ["property-system"],
  },
  {
    sector: "maintenance",
    description: "Record vehicle inspection",
    code: "ASSET_INSPECTION_RECORDING",
    category: "Maintenance",
    tools: ["maintenance-system"],
  },
  {
    sector: "professional services",
    description: "Review client deliverable",
    code: "DELIVERABLE_REVIEW",
    category: "Service Delivery",
    tools: ["document-system"],
  },
] as const;

describe("sector-agnostic Work Intelligence", () => {
  it.each(sectors)("uses the same pipeline for $sector", (fixture) => {
    const normalizer = new DeterministicActivityNormalizer(
      [{ code: fixture.code, category: fixture.category, terms: [fixture.description] }],
      `fixture-${fixture.sector}-v1`,
    );
    const normalization = normalizer.normalize(fixture.description);
    const observations = Array.from({ length: 6 }, (_, index) =>
      WorkActivity.create({
        activityId: `${fixture.code}-${index}`,
        tenantId: "tenant-sector-test",
        companyId: `company-${fixture.sector}`,
        actorRole: "operator",
        evidenceKind: "OBSERVED",
        activityType: "WORK",
        originalDescription: fixture.description,
        normalizedActivity: normalization.normalizedActivity,
        category: normalization.category,
        tools: fixture.tools,
        startedAt: new Date(`2026-07-${String(index + 1).padStart(2, "0")}T09:00:00Z`),
        durationMinutes: 60,
        source: "MANUAL",
        confidence: normalization.confidence,
        confirmationState: "CONFIRMED",
        humanJudgment: 20,
        operationalRisk: 20,
        provenance: [`fixture:${fixture.sector}:${index}`],
      }),
    );
    const pattern = new WorkPatternEngine().analyze(observations).patterns[0]!;
    const opportunity = new WorkAutomationHypothesisEngine().evaluate(pattern, {
      knownToolIds: [],
      declaredActivityCodes: [],
      evidenceReferences: [`audit:${fixture.sector}`],
    });
    const candidate = qualifyAutomationCandidate(opportunity, pattern);

    expect(pattern.normalizedActivity).toBe(fixture.code);
    expect(pattern.sampleCount).toBe(6);
    expect(opportunity.score).toBeGreaterThanOrEqual(65);
    expect(opportunity.contributions.toolReadiness).toBeDefined();
    expect(estimateTimeSavings(pattern, opportunity.proposedGovernance)).not.toHaveProperty(
      "financialRoi",
    );
    expect(candidate?.provenance).toContain(`audit:${fixture.sector}`);
  });

  it("has no built-in sector vocabulary", () => {
    const result = new DeterministicActivityNormalizer().normalize("Any legitimate work activity");
    expect(result).toMatchObject({ category: "Other", confidence: 40 });
    expect(result.normalizedActivity).toBe("OTHER_ANY_LEGITIMATE_WORK_ACTIVITY");
  });

  it("rejects ambiguous duplicate configuration", () => {
    expect(
      () =>
        new DeterministicActivityNormalizer([
          { code: "ACTIVITY", category: "One", terms: ["one"] },
          { code: "ACTIVITY", category: "Two", terms: ["two"] },
        ]),
    ).toThrow("Duplicate normalization rule");
  });
});
