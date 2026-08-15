import { describe, expect, it } from "vitest";
import { DeterministicAIProvider } from "../../brain-evaluation/ai-interpretation-gateway";
import {
  CompanyActor,
  CompanyIntake,
  IntakeInterpretationAdapter,
  IntakeReadinessAssessmentService,
  IntakeSession,
  IntakeSource,
  InMemoryCompanyIntakeRepository,
} from "./index";
import type { IntakeSourceType } from "./index";

const tenant = "tenant-a";
const company = "company-a";
const intake = () =>
  CompanyIntake.create({
    tenantId: tenant,
    companyId: company,
    displayName: "Services Co",
    industry: "Professional services",
    size: "50",
  });
const source = (
  sourceId: string,
  sourceType: IntakeSourceType,
  rawText = "The warehouse is the problem.",
) =>
  IntakeSource.create({
    sourceId,
    tenantId: tenant,
    companyId: company,
    sourceType,
    title: sourceId,
    origin: "customer-provided",
    rawText,
    reliability: 0.8,
  });

describe("F1.1 corporate intake foundation", () => {
  it("creates an intake with optional unknown fields", () => {
    const value = intake();
    expect(value.status).toBe("DRAFT");
    expect(value.knownSystems).toEqual([]);
    expect(Object.isFrozen(value)).toBe(true);
  });

  it("preserves source provenance and raw content", () => {
    const value = source("ceo", "OWNER_INPUT");
    expect(value.tenantId).toBe(tenant);
    expect(value.companyId).toBe(company);
    expect(value.rawText).toContain("warehouse");
    expect(value.processingStatus).toBe("PENDING");
  });

  it("creates actors without inferring authority from a title", () => {
    const actor = CompanyActor.create({
      actorId: "ceo-1",
      tenantId: tenant,
      companyId: company,
      role: "CEO",
    });
    expect(actor.authorityContext).toBeUndefined();
  });

  it("creates a bounded intake session", () => {
    const session = IntakeSession.create({
      sessionId: "session-1",
      tenantId: tenant,
      companyId: company,
      objective: "Understand operations",
      sourceIds: ["ceo"],
    });
    expect(session.status).toBe("DRAFT");
    expect(session.sourceIds).toEqual(["ceo"]);
  });

  it("keeps raw intake separate from interpreted candidates and enters E3", async () => {
    const session = IntakeSession.create({
      sessionId: "session-1",
      tenantId: tenant,
      companyId: company,
    });
    const result = await new IntakeInterpretationAdapter(new DeterministicAIProvider()).interpret(
      source("ceo", "OWNER_INPUT", "Our warehouse is the problem."),
      session,
    );
    expect(result.interpretation.provider).toBe("deterministic-test-provider");
    expect(result.interpretation.candidates[0]?.status).toBe("AI_DERIVED");
    expect(result.interpretation.candidates[0]?.sourceReference).toBe("ceo:1");
    expect(result.source.rawText).toBe("Our warehouse is the problem.");
    // No CompanyIntake mutation or FACT promotion is performed by this adapter.
  });

  it("rejects cross-company source/session correlation", async () => {
    const session = IntakeSession.create({
      sessionId: "session-1",
      tenantId: tenant,
      companyId: company,
    });
    const foreign = IntakeSource.create({
      sourceId: "foreign",
      tenantId: tenant,
      companyId: "company-b",
      sourceType: "DOCUMENT",
      title: "foreign",
      origin: "other",
      rawText: "secret",
    });
    await expect(
      new IntakeInterpretationAdapter(new DeterministicAIProvider()).interpret(foreign, session),
    ).rejects.toThrow("scope mismatch");
  });

  it("assesses readiness deterministically", () => {
    const service = new IntakeReadinessAssessmentService();
    expect(service.assess(intake(), []).status).toBe("NOT_READY");
    const pending = service.assess(intake(), [source("ceo", "OWNER_INPUT")]);
    expect(pending.status).toBe("READY_FOR_INTERPRETATION");
    const processed = [
      IntakeSource.create({ ...source("ceo", "OWNER_INPUT"), processingStatus: "PROCESSED" }),
      IntakeSource.create({ ...source("sop", "SOP"), processingStatus: "PROCESSED" }),
    ];
    expect(service.assess(intake(), processed).status).toBe("READY_FOR_BRAIN");
  });

  it("assesses canonical production state without creating a second lifecycle", () => {
    const service = new IntakeReadinessAssessmentService();
    const incomplete = service.assessProduction(
      {
        company: { id: company, organizationId: tenant },
        discovery: { exists: true, validated: true },
        interviews: { exists: true, completed: true },
        knowledgeSnapshot: { exists: true, validated: true },
        processMap: { exists: true, published: false },
      },
      tenant,
    );
    expect(incomplete.status).toBe("PARTIALLY_READY");
    expect(incomplete.criticalGaps).toContain("published process map");

    const ready = service.assessProduction(
      {
        company: { id: company, organizationId: tenant },
        discovery: { exists: true, validated: true },
        interviews: { exists: true, completed: true },
        knowledgeSnapshot: { exists: true, validated: true },
        processMap: { exists: true, published: true },
      },
      tenant,
    );
    expect(ready.status).toBe("READY_FOR_BRAIN");
    expect(ready.companyId).toBe(company);
    expect(ready.tenantId).toBe(tenant);
  });

  it("enforces tenant isolation in the memory repository", async () => {
    const repository = new InMemoryCompanyIntakeRepository();
    await repository.saveIntake(intake());
    await repository.saveSource(source("a", "OWNER_INPUT"));
    expect(await repository.getIntake(tenant, company)).toBeTruthy();
    expect(await repository.getIntake("tenant-b", company)).toBeNull();
    expect(await repository.listSources("tenant-b", company)).toHaveLength(0);
  });

  it("supports the realistic five-source flow without auto-promoting the CEO opinion", async () => {
    const session = IntakeSession.create({
      sessionId: "realistic",
      tenantId: tenant,
      companyId: company,
      status: "COLLECTING",
    });
    const sources = [
      source("ceo", "OWNER_INPUT"),
      source("ops", "MANAGER_INTERVIEW", "Operations reports delays and uncertainty."),
      source("operator", "EMPLOYEE_INTERVIEW"),
      source("sop", "SOP"),
      source("csv", "SYSTEM_EXPORT"),
    ];
    const adapter = new IntakeInterpretationAdapter(new DeterministicAIProvider());
    const results = await Promise.all(sources.map((item) => adapter.interpret(item, session)));
    expect(results).toHaveLength(5);
    expect(
      results.every((item) => item.interpretation.candidates[0]?.status === "AI_DERIVED"),
    ).toBe(true);
    expect(
      results.every((item) =>
        item.interpretation.candidates[0]?.sourceReference.startsWith(item.source.sourceId),
      ),
    ).toBe(true);
  });
});
