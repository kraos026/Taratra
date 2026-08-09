import { describe, expect, it, vi } from "vitest";
import type { AssistedAuditRepositoryPort, AssistedAuditState } from "./assisted-audit-port";
import { AssistedAuditService } from "./assisted-audit-service";

describe("AssistedAuditService", () => {
  it("starts a new company at Company Information", async () => {
    const result = await evaluate({ discovery: null });
    expect(result).toMatchObject({ currentStage: "DISCOVERY", nextAction: "START_DISCOVERY" });
  });

  it("continues an incomplete Discovery", async () => {
    const result = await evaluate({ discovery: record("discovery", "in_progress") });
    expect(result).toMatchObject({ currentStage: "DISCOVERY", nextAction: "CONTINUE_DISCOVERY" });
  });

  it("requires Discovery validation before Interview", async () => {
    const result = await evaluate({ discovery: record("discovery", "completed") });
    expect(result).toMatchObject({ currentStage: "DISCOVERY", nextAction: "VALIDATE_DISCOVERY" });
  });

  it("moves validated Discovery to Interview", async () => {
    const result = await evaluate({ interview: null });
    expect(result).toMatchObject({ currentStage: "INTERVIEW", nextAction: "START_INTERVIEW" });
  });

  it("continues an incomplete Interview", async () => {
    const result = await evaluate({ interview: record("interview", "in_progress") });
    expect(result).toMatchObject({ currentStage: "INTERVIEW", nextAction: "CONTINUE_INTERVIEW" });
  });

  it("requires explicit validation for a completed Interview", async () => {
    const result = await evaluate({ interview: record("interview", "completed") });
    expect(result).toMatchObject({ currentStage: "INTERVIEW", nextAction: "VALIDATE_INTERVIEW" });
  });

  it("moves validated sources to Knowledge", async () => {
    const result = await evaluate({ knowledge: null });
    expect(result).toMatchObject({ currentStage: "KNOWLEDGE", nextAction: "BUILD_KNOWLEDGE" });
  });

  it("moves READY Knowledge to Process Mapping", async () => {
    const result = await evaluate({ processMaps: [] });
    expect(result).toMatchObject({ currentStage: "PROCESS_MAP", nextAction: "BUILD_PROCESS_MAP" });
  });

  it("never selects between multiple Process Map lineages", async () => {
    const first = { ...record("map-a", "draft"), lineageKey: "pattern-a" };
    const second = { ...record("map-b", "published"), lineageKey: "pattern-b" };
    const result = await evaluate({ processMaps: [first, second] });
    expect(result).toMatchObject({
      currentStage: "PROCESS_MAP",
      overallStatus: "AMBIGUOUS",
      nextAction: "SELECT_PROCESS_MAP",
    });
    expect(
      result.stages.find((stage) => stage.stage === "PROCESS_MAP")?.candidateArtifacts,
    ).toEqual([expect.objectContaining({ id: "map-a" }), expect.objectContaining({ id: "map-b" })]);
  });

  it("recognizes an explicit Process Map choice only from its real downstream artifact", async () => {
    const result = await evaluate({
      processMaps: [
        { ...record("map-a", "published"), lineageKey: "pattern-a" },
        { ...record("map-b", "published"), lineageKey: "pattern-b" },
      ],
      selectedProcessMapId: "map-b",
      analysis: record("analysis", "draft"),
    });
    expect(result).toMatchObject({
      currentStage: "BUSINESS_ANALYSIS",
      nextAction: "VALIDATE_ANALYSIS",
    });
    expect(result.stages.find((stage) => stage.stage === "PROCESS_MAP")?.artifact?.id).toBe(
      "map-b",
    );
  });

  it("uses only the newest version inside one Process Map lineage", async () => {
    const result = await evaluate({
      processMaps: [
        { ...record("map-v1", "published", 1), lineageKey: "pattern" },
        { ...record("map-v2", "draft", 2), lineageKey: "pattern" },
      ],
    });
    expect(result).toMatchObject({
      currentStage: "PROCESS_MAP",
      nextAction: "VALIDATE_PROCESS_MAP",
    });
    expect(result.stages[3]?.artifact?.id).toBe("map-v2");
  });

  it("moves a validated Process Map to publication", async () => {
    const result = await evaluate({
      processMaps: [{ ...record("map", "validated"), lineageKey: "pattern" }],
    });
    expect(result).toMatchObject({
      currentStage: "PROCESS_MAP",
      nextAction: "PUBLISH_PROCESS_MAP",
    });
  });

  it("moves a published Process Map to Analysis", async () => {
    const result = await evaluate({ analysis: null });
    expect(result).toMatchObject({
      currentStage: "BUSINESS_ANALYSIS",
      nextAction: "GENERATE_ANALYSIS",
    });
  });

  it("does not bypass an Analysis draft", async () => {
    const result = await evaluate({ analysis: record("analysis", "draft") });
    expect(result).toMatchObject({
      currentStage: "BUSINESS_ANALYSIS",
      nextAction: "VALIDATE_ANALYSIS",
    });
  });

  it("moves published Analysis to AI Opportunities", async () => {
    const result = await evaluate({ aiOpportunities: null });
    expect(result).toMatchObject({
      currentStage: "AI_OPPORTUNITIES",
      nextAction: "GENERATE_AI_OPPORTUNITIES",
    });
  });

  it("moves published AI Opportunities to Automation Opportunities", async () => {
    const result = await evaluate({ automationOpportunities: null });
    expect(result).toMatchObject({
      currentStage: "AUTOMATION_OPPORTUNITIES",
      nextAction: "GENERATE_AUTOMATION_OPPORTUNITIES",
    });
  });

  it("requires explicit ROI assumptions after published Automation Opportunities", async () => {
    const result = await evaluate({ roi: null });
    expect(result).toMatchObject({ currentStage: "ROI", nextAction: "ENTER_ROI_ASSUMPTIONS" });
  });

  it("moves published ROI to Recommendations", async () => {
    const result = await evaluate({ recommendations: null });
    expect(result).toMatchObject({
      currentStage: "RECOMMENDATIONS",
      nextAction: "GENERATE_RECOMMENDATIONS",
    });
  });

  it("completes only after Recommendations are published", async () => {
    const result = await evaluate();
    expect(result).toMatchObject({
      currentStage: "COMPLETED",
      overallStatus: "COMPLETED",
      nextAction: "VIEW_RESULTS",
    });
  });

  it("keeps viewers read-only", async () => {
    const result = await evaluate({ role: "viewer", analysis: record("analysis", "draft") });
    expect(result.currentStage).toBe("BUSINESS_ANALYSIS");
    expect(result.nextAction).toBeNull();
    expect(result.stages.find((stage) => stage.stage === "BUSINESS_ANALYSIS")).toMatchObject({
      availableActions: [],
      blockingReason: "This role has read-only access",
    });
  });

  it("does not let consultants publish", async () => {
    const result = await evaluate({
      role: "consultant",
      processMaps: [{ ...record("map", "validated"), lineageKey: "pattern" }],
    });
    expect(result).toMatchObject({ currentStage: "PROCESS_MAP", nextAction: null });
    expect(result.blockingReason).toContain("owner or admin");
  });

  it("does not let consultants validate Interviews", async () => {
    const result = await evaluate({
      role: "consultant",
      interview: record("interview", "completed"),
    });
    expect(result).toMatchObject({ currentStage: "INTERVIEW", nextAction: null });
  });

  it("rejects companies hidden by tenant isolation", async () => {
    const repository = { read: vi.fn().mockResolvedValue(null) };
    await expect(
      new AssistedAuditService(repository, "user").get("foreign-company"),
    ).rejects.toMatchObject({ code: "COMPANY_NOT_FOUND", status: 404 });
  });

  it("returns only artifact identifiers supplied by the repository", async () => {
    const result = await evaluate();
    const ids = result.stages.flatMap((stage) => [
      ...(stage.artifact ? [stage.artifact.id] : []),
      ...stage.candidateArtifacts.map((candidate) => candidate.id),
    ]);
    expect(ids).toContain("recommendations");
    expect(ids.every((id) => canonicalStateIds.has(id))).toBe(true);
  });
});

const canonicalStateIds = new Set([
  "discovery",
  "interview",
  "knowledge",
  "process-map",
  "analysis",
  "ai",
  "automation",
  "roi",
  "recommendations",
]);

function completeState(): AssistedAuditState {
  return {
    company: { id: "company", name: "Canonical Company" },
    role: "owner",
    discovery: record("discovery", "validated"),
    interview: record("interview", "validated"),
    knowledge: record("knowledge", "ready"),
    processMaps: [{ ...record("process-map", "published"), lineageKey: "pattern" }],
    selectedProcessMapId: "process-map",
    analysis: record("analysis", "published"),
    aiOpportunities: record("ai", "published"),
    automationOpportunities: record("automation", "published"),
    roi: record("roi", "published"),
    recommendations: record("recommendations", "published"),
  };
}

function record(id: string, status: string, version = 1) {
  return { id, status, version, lockVersion: 1 };
}

async function evaluate(overrides: Partial<AssistedAuditState> = {}) {
  const state = { ...completeState(), ...overrides };
  const repository: AssistedAuditRepositoryPort = { read: vi.fn().mockResolvedValue(state) };
  return new AssistedAuditService(repository, "user").get("company");
}
