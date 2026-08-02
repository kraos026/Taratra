import { describe, expect, it } from "vitest";

import { WorkIntelligenceService } from "./application/work-intelligence-service";
import {
  AutomationOpportunityEngine,
  DeterministicActivityNormalizer,
  qualifyAutomationCandidate,
  timeRoiBaseline,
  WorkActivity,
  WorkIntelligenceError,
  WorkPatternEngine,
} from "./domain/work-intelligence";
import { InMemoryWorkActivityRepository } from "./infrastructure/in-memory-work-activity-repository";

const normalizer = new DeterministicActivityNormalizer();

function activity(
  id: string,
  description = "Update product catalogue",
  options: Partial<Parameters<typeof WorkActivity.create>[0]> = {},
): WorkActivity {
  const normalized = normalizer.normalize(description);
  return WorkActivity.create({
    activityId: id,
    tenantId: "tenant-a",
    companyId: "company-a",
    actorRole: "operations",
    evidenceKind: "OBSERVED",
    activityType: "WORK",
    originalDescription: description,
    normalizedActivity: normalized.normalizedActivity,
    category: normalized.category,
    tools: ["shopify"],
    startedAt: new Date(
      `2026-07-${String(Number(id.replace(/\D/g, "")) || 1).padStart(2, "0")}T09:00:00Z`,
    ),
    durationMinutes: 45,
    source: "MANUAL",
    confidence: 90,
    confirmationState: "CONFIRMED",
    humanJudgment: 10,
    operationalRisk: 15,
    provenance: [`capture:${id}`],
    ...options,
  });
}

describe("WorkActivity", () => {
  it("creates a validated immutable observation", () => {
    const value = activity("a1");
    expect(Object.isFrozen(value)).toBe(true);
    expect(value.durationMinutes).toBe(45);
  });

  it("rejects missing provenance", () => {
    expect(() => activity("a1", "work", { provenance: [] })).toThrow(WorkIntelligenceError);
  });

  it("rejects invalid confidence", () => {
    expect(() => activity("a1", "work", { confidence: 101 })).toThrow("confidence");
  });

  it("creates a new confirmed version", () => {
    const confirmed = activity("a1", "work", { confirmationState: "PENDING" }).confirm("a2");
    expect(confirmed).toMatchObject({ version: 2, confidence: 100, source: "MANUAL" });
  });

  it("creates a traceable corrected version", () => {
    const corrected = activity("a1").correct("a2", { durationMinutes: 20 });
    expect(corrected).toMatchObject({
      version: 2,
      supersedesActivityId: "a1",
      durationMinutes: 20,
    });
    expect(corrected.provenance).toContain("human-correction:a2");
  });

  it("does not confirm rejected evidence", () => {
    expect(() => activity("a1", "work", { confirmationState: "REJECTED" }).confirm("a2")).toThrow();
  });
});

describe("deterministic normalization and patterns", () => {
  it.each([
    ["répondre aux mails clients", "CUSTOMER_SUPPORT_RESPONSE"],
    ["mettre à jour une fiche produit", "PRODUCT_CATALOG_UPDATE"],
    ["préparer le rapport hebdomadaire", "PERFORMANCE_REPORTING"],
    ["créer du contenu Canva", "CONTENT_CREATION"],
  ])("normalizes %s", (description, expected) => {
    expect(normalizer.normalize(description).normalizedActivity).toBe(expected);
  });

  it("is stable for identical input", () => {
    expect(normalizer.normalize("Update catalogue")).toEqual(
      normalizer.normalize("Update catalogue"),
    );
  });

  it("requires three confirmed observations", () => {
    const analysis = new WorkPatternEngine().analyze([activity("a1"), activity("a2")]);
    expect(analysis.patterns).toHaveLength(0);
    expect(analysis.insufficientGroups[0]?.sampleCount).toBe(2);
  });

  it("detects a recurring pattern", () => {
    const pattern = new WorkPatternEngine().analyze([
      activity("a1"),
      activity("a2"),
      activity("a3"),
      activity("a4"),
      activity("a5"),
      activity("a6"),
    ]).patterns[0];
    expect(pattern).toMatchObject({ sampleCount: 6, normalizedActivity: "PRODUCT_CATALOG_UPDATE" });
    expect(pattern?.provenance).toHaveLength(6);
  });

  it("never aggregates tenants", () => {
    const analysis = new WorkPatternEngine().analyze([
      activity("a1"),
      activity("a2"),
      activity("b1", "Update product catalogue", { tenantId: "tenant-b" }),
      activity("b2", "Update product catalogue", { tenantId: "tenant-b" }),
    ]);
    expect(analysis.patterns).toHaveLength(0);
    expect(analysis.insufficientGroups).toHaveLength(2);
  });

  it("gives the human correction priority over its prior version", () => {
    const original = activity("a1");
    const corrected = original.correct("a2", { normalizedActivity: "PERFORMANCE_REPORTING" });
    const analysis = new WorkPatternEngine().analyze([
      original,
      corrected,
      activity("b1"),
      activity("b2"),
    ]);
    expect(
      analysis.insufficientGroups.find(
        (group) => group.normalizedActivity === "PRODUCT_CATALOG_UPDATE",
      )?.sampleCount,
    ).toBe(2);
  });
});

describe("opportunity, ROI, and V1 to V2 candidate bridge", () => {
  const pattern = new WorkPatternEngine().analyze(
    Array.from({ length: 6 }, (_, index) => activity(`a${index + 1}`)),
  ).patterns[0]!;
  const opportunity = new AutomationOpportunityEngine().evaluate(pattern, {
    knownToolIds: ["shopify"],
    declaredActivityCodes: ["PRODUCT_CATALOG_UPDATE"],
    evidenceReferences: ["audit:published:42"],
  });

  it("produces an explainable score", () => {
    expect(opportunity.score).toBeGreaterThanOrEqual(65);
    expect(Object.keys(opportunity.contributions)).toHaveLength(7);
    expect(opportunity.explanation).toContain("observed 6 times");
  });

  it("preserves audit and observation provenance", () => {
    expect(opportunity.provenance).toContain("audit:published:42");
    expect(opportunity.provenance).toContain("a1");
  });

  it("uses a time-only ROI baseline", () => {
    expect(timeRoiBaseline(pattern, opportunity.level)).toMatchObject({
      financialRoi: "UNAVAILABLE",
    });
  });

  it("qualifies a traceable candidate without invoking compiler or runtime", () => {
    const candidate = qualifyAutomationCandidate(opportunity, pattern);
    expect(candidate?.sourceOpportunityId).toBe(opportunity.opportunityId);
    expect(candidate?.supportingObservationIds).toHaveLength(6);
  });

  it("rejects a low-confidence candidate", () => {
    expect(qualifyAutomationCandidate({ ...opportunity, confidence: 20 }, pattern)).toBeNull();
  });

  it("requires human approval unless autonomy is justified", () => {
    expect(qualifyAutomationCandidate(opportunity, pattern)?.requiresHumanApproval).toBe(false);
  });
});

describe("capture application and repository", () => {
  const clock = { now: () => new Date("2026-08-02T10:00:00Z") };
  let sequence = 0;
  const identities = { nextId: () => `generated-${++sequence}` };

  function input(description: string) {
    return {
      tenantId: "tenant-a",
      companyId: "company-a",
      actorRole: "support",
      evidenceKind: "OBSERVED" as const,
      activityType: "WORK",
      originalDescription: description,
      tools: ["gmail"],
      startedAt: new Date("2026-08-02T09:00:00Z"),
      durationMinutes: 20,
      source: "MANUAL" as const,
      confirmationState: "PENDING" as const,
      humanJudgment: 60,
      operationalRisk: 30,
      provenance: ["daily-capture"],
    };
  }

  it("captures, confirms and keeps history", async () => {
    const repository = new InMemoryWorkActivityRepository();
    const service = new WorkIntelligenceService(repository, normalizer, identities, clock);
    const captured = await service.capture(input("répondre aux mails clients"));
    const confirmed = await service.confirm("tenant-a", "company-a", captured.lineageId);
    expect(confirmed.version).toBe(2);
    expect(await repository.history("tenant-a", "company-a", captured.lineageId)).toHaveLength(2);
  });

  it("isolates tenant reads", async () => {
    const repository = new InMemoryWorkActivityRepository();
    const service = new WorkIntelligenceService(repository, normalizer, identities, clock);
    await service.capture(input("customer email support"));
    expect(await repository.list("tenant-b", "company-a")).toHaveLength(0);
  });

  it("applies a day atomically", async () => {
    const repository = new InMemoryWorkActivityRepository();
    const service = new WorkIntelligenceService(repository, normalizer, identities, clock);
    await service.captureDay([input("customer support email"), input("weekly report")]);
    expect(await repository.list("tenant-a", "company-a")).toHaveLength(2);
  });

  it("rejects a stale optimistic version", async () => {
    const repository = new InMemoryWorkActivityRepository();
    const value = activity("a1");
    await repository.append(value, 0);
    await expect(repository.append(value.confirm("a2"), 0)).rejects.toThrow("version conflict");
  });

  it("does not expose another tenant through correction", async () => {
    const repository = new InMemoryWorkActivityRepository();
    const service = new WorkIntelligenceService(repository, normalizer, identities, clock);
    const captured = await service.capture(input("weekly report"));
    await expect(service.correct("tenant-b", "company-a", captured.lineageId, {})).rejects.toThrow(
      "not found",
    );
  });
});

describe("e-commerce acceptance scenario", () => {
  it("discovers automation, approval, and insufficient-data outcomes with provenance", () => {
    const observations = [
      ...Array.from({ length: 6 }, (_, index) =>
        activity(`p${index + 1}`, "Update product catalogue", {
          tools: ["shopify", "sheets"],
          humanJudgment: 10,
          operationalRisk: 15,
        }),
      ),
      ...Array.from({ length: 6 }, (_, index) =>
        activity(`s${index + 7}`, "Customer email support", {
          tools: ["gmail", "shopify"],
          humanJudgment: 60,
          operationalRisk: 35,
        }),
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        activity(`r${index + 13}`, "Weekly reporting", {
          tools: ["sheets", "advertising", "payments"],
        }),
      ),
      activity("c16", "Content creation in Canva", { tools: ["canva"] }),
      activity("c17", "Content creation in Canva", { tools: ["canva"] }),
      activity("x18", "Escalate exceptional customer dispute", {
        tools: ["gmail"],
        humanJudgment: 95,
        operationalRisk: 85,
      }),
    ];
    const analysis = new WorkPatternEngine().analyze(observations);
    const opportunities = analysis.patterns.map((pattern) => ({
      pattern,
      opportunity: new AutomationOpportunityEngine().evaluate(pattern, {
        knownToolIds: ["gmail", "shopify", "sheets", "advertising", "payments", "canva"],
        declaredActivityCodes: analysis.patterns.map((item) => item.normalizedActivity),
        evidenceReferences: ["audit:published:ecommerce"],
      }),
    }));
    const product = opportunities.find(
      ({ pattern }) => pattern.normalizedActivity === "PRODUCT_CATALOG_UPDATE",
    );
    const support = opportunities.find(
      ({ pattern }) => pattern.normalizedActivity === "CUSTOMER_SUPPORT_RESPONSE",
    );
    expect(analysis.patterns.length).toBeGreaterThanOrEqual(3);
    expect(product?.opportunity.level).toBe("AUTONOMOUS");
    expect(
      qualifyAutomationCandidate(product!.opportunity, product!.pattern)?.provenance,
    ).toContain("audit:published:ecommerce");
    expect(support?.opportunity.level).toBe("AUTOMATION_WITH_APPROVAL");
    expect(
      qualifyAutomationCandidate(support!.opportunity, support!.pattern)?.requiresHumanApproval,
    ).toBe(true);
    expect("employeeProductivityScore" in support!.opportunity).toBe(false);
    expect("employeeRanking" in support!.opportunity).toBe(false);
    expect("disciplinaryScore" in support!.opportunity).toBe(false);
    expect(
      analysis.insufficientGroups.find((group) => group.normalizedActivity === "CONTENT_CREATION"),
    ).toMatchObject({ sampleCount: 2 });
  });
});
