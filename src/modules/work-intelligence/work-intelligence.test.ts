import { describe, expect, it } from "vitest";

import { WorkIntelligenceService } from "./application/work-intelligence-service";
import {
  WorkAutomationHypothesisEngine,
  DeterministicActivityNormalizer,
  qualifyAutomationCandidate,
  estimateTimeSavings,
  WorkActivity,
  WorkIntelligenceError,
  WorkPatternEngine,
} from "./domain/work-intelligence";
import { InMemoryWorkActivityRepository } from "./infrastructure/in-memory-work-activity-repository";

const normalizer = new DeterministicActivityNormalizer(
  [
    {
      code: "CUSTOMER_SUPPORT_RESPONSE",
      category: "Customer Support",
      terms: [
        "mail client",
        "mails clients",
        "email support",
        "sav",
        "customer email",
        "complaint",
      ],
    },
    {
      code: "PRODUCT_CATALOG_UPDATE",
      category: "E-commerce",
      terms: ["product update", "catalogue", "fiche produit", "product sheet"],
    },
    {
      code: "PERFORMANCE_REPORTING",
      category: "Reporting",
      terms: ["report", "reporting", "rapport", "dashboard"],
    },
    {
      code: "CONTENT_CREATION",
      category: "Marketing",
      terms: ["content", "contenu", "canva", "creative"],
    },
  ],
  "ecommerce-acceptance-rules-v1",
);

function uuid(label: string): string {
  const digits = label.replace(/\D/g, "").padStart(12, "0").slice(-12);
  const code = String(
    label
      .replace(/[^a-z]/gi, "")
      .toLowerCase()
      .charCodeAt(0) || 1,
  ).padStart(3, "0");
  return `10000000-0000-4000-8000-${code}${digits.slice(3)}`;
}

function activity(
  id: string,
  description = "Update product catalogue",
  options: Partial<Parameters<typeof WorkActivity.create>[0]> = {},
): WorkActivity {
  const normalized = normalizer.normalize(description);
  const activityId = uuid(id);
  return WorkActivity.create({
    activityId,
    tenantId: "20000000-0000-4000-8000-000000000001",
    companyId: "30000000-0000-4000-8000-000000000001",
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
    provenance: [`capture:${activityId}`],
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
    const confirmed = activity("a1", "work", { confirmationState: "PENDING" }).confirm(uuid("a2"));
    expect(confirmed).toMatchObject({ version: 2, confidence: 100, source: "MANUAL" });
  });

  it("creates a traceable corrected version", () => {
    const corrected = activity("a1").correct(uuid("a2"), { durationMinutes: 20 });
    expect(corrected).toMatchObject({
      version: 2,
      supersedesActivityId: uuid("a1"),
      durationMinutes: 20,
    });
    expect(corrected.provenance).toContain(`human-correction:${uuid("a2")}`);
  });

  it("does not confirm rejected evidence", () => {
    expect(() =>
      activity("a1", "work", { confirmationState: "REJECTED" }).confirm(uuid("a2")),
    ).toThrow();
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
    const corrected = original.correct(uuid("a2"), { normalizedActivity: "PERFORMANCE_REPORTING" });
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

describe("work hypothesis, time savings, and candidate qualification", () => {
  const pattern = new WorkPatternEngine().analyze(
    Array.from({ length: 6 }, (_, index) => activity(`a${index + 1}`)),
  ).patterns[0]!;
  const opportunity = new WorkAutomationHypothesisEngine().evaluate(pattern, {
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
    expect(opportunity.provenance).toContain(uuid("a1"));
  });

  it("uses a time-only ROI baseline", () => {
    const estimate = estimateTimeSavings(pattern, opportunity.proposedGovernance);
    expect(estimate.estimatedAutomatableTimeMinutes).toBeGreaterThan(0);
    expect(estimate.provenance).toEqual(pattern.provenance);
    expect(estimate).not.toHaveProperty("financialRoi");
    expect(estimate).not.toHaveProperty("salary");
  });

  it("qualifies a traceable candidate without invoking compiler or runtime", () => {
    const candidate = qualifyAutomationCandidate(opportunity, pattern);
    expect(candidate?.sourceHypothesisId).toBe(opportunity.hypothesisId);
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
  const identities = { nextId: () => uuid(`generated-${++sequence}`) };

  function input(description: string) {
    return {
      tenantId: "20000000-0000-4000-8000-000000000001",
      companyId: "30000000-0000-4000-8000-000000000001",
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
    const confirmed = await service.confirm(
      "20000000-0000-4000-8000-000000000001",
      "30000000-0000-4000-8000-000000000001",
      captured.lineageId,
    );
    expect(confirmed.version).toBe(2);
    expect(
      await repository.history(
        "20000000-0000-4000-8000-000000000001",
        "30000000-0000-4000-8000-000000000001",
        captured.lineageId,
      ),
    ).toHaveLength(2);
  });

  it("isolates tenant reads", async () => {
    const repository = new InMemoryWorkActivityRepository();
    const service = new WorkIntelligenceService(repository, normalizer, identities, clock);
    await service.capture(input("customer email support"));
    expect(
      await repository.list(
        "20000000-0000-4000-8000-000000000002",
        "30000000-0000-4000-8000-000000000001",
      ),
    ).toHaveLength(0);
  });

  it("applies a day atomically", async () => {
    const repository = new InMemoryWorkActivityRepository();
    const service = new WorkIntelligenceService(repository, normalizer, identities, clock);
    await service.captureDay([input("customer support email"), input("weekly report")]);
    expect(
      await repository.list(
        "20000000-0000-4000-8000-000000000001",
        "30000000-0000-4000-8000-000000000001",
      ),
    ).toHaveLength(2);
  });

  it("rejects a stale optimistic version", async () => {
    const repository = new InMemoryWorkActivityRepository();
    const value = activity("a1");
    await repository.append(value, 0);
    await expect(repository.append(value.confirm(uuid("a2")), 0)).rejects.toThrow(
      "version conflict",
    );
  });

  it("does not expose another tenant through correction", async () => {
    const repository = new InMemoryWorkActivityRepository();
    const service = new WorkIntelligenceService(repository, normalizer, identities, clock);
    const captured = await service.capture(input("weekly report"));
    await expect(
      service.correct(
        "20000000-0000-4000-8000-000000000002",
        "30000000-0000-4000-8000-000000000001",
        captured.lineageId,
        {},
      ),
    ).rejects.toThrow("not found");
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
      opportunity: new WorkAutomationHypothesisEngine().evaluate(pattern, {
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
    expect(product?.opportunity.proposedGovernance).toBe("AUTONOMOUS");
    expect(
      qualifyAutomationCandidate(product!.opportunity, product!.pattern)?.provenance,
    ).toContain("audit:published:ecommerce");
    expect(support?.opportunity.proposedGovernance).toBe("AUTOMATION_WITH_APPROVAL");
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
