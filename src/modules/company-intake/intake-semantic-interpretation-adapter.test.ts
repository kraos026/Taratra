import { describe, expect, it } from "vitest";
import type { AIProvider } from "../../brain-evaluation/ai-interpretation-gateway";
import { IntakeInterpretationAdapter } from "./index";
import { IntakeSession, IntakeSource } from "./domain/company-intake";

describe("IntakeInterpretationAdapter enterprise semantics", () => {
  it("sends bounded company-scoped semantic context through E3", async () => {
    const seen: unknown[] = [];
    const provider: AIProvider = {
      providerId: "semantic-test",
      async interpret(request) {
        seen.push(request);
        return {
          requestId: request.requestId,
          provider: "semantic-test",
          model: "fixture",
          task: request.task,
          schemaVersion: request.schemaVersion,
          candidates: [],
          sourceReferences: [request.sourceId],
          warnings: [],
          validationIssues: [],
          createdAt: new Date("2026-01-01T00:00:00Z"),
        };
      },
    };
    await new IntakeInterpretationAdapter(provider).interpretEnterpriseSemantics(
      source(),
      session(),
      {
        sourceVersion: 3,
        knownTerminology: Array.from({ length: 20 }, (_, index) => `term-${index}`),
        relevantProcessContext: ["approval queue", "ERP entry"],
        relatedKnowledgeReferences: ["knowledge:bt", "knowledge:adv"],
      },
    );
    expect(seen[0]).toMatchObject({
      tenantId: "tenant-a",
      companyId: "company-a",
      sourceId: "interview-1",
      task: "SEMANTIC_ENTERPRISE_UNDERSTANDING",
      schemaVersion: "semantic-enterprise-v1",
    });
    expect((seen[0] as { knownClaims: readonly string[] }).knownClaims).toHaveLength(12);
    expect((seen[0] as { traceContext: Record<string, string> }).traceContext).toMatchObject({
      companyId: "company-a",
      sourceId: "interview-1",
      sessionId: "session-1",
      sourceVersion: "3",
    });
  });

  it("rejects cross-company source/session semantic interpretation", async () => {
    await expect(
      new IntakeInterpretationAdapter(emptyProvider()).interpretEnterpriseSemantics(
        source({ companyId: "company-b" }),
        session(),
      ),
    ).rejects.toThrow("scope mismatch");
  });
});

function emptyProvider(): AIProvider {
  return {
    providerId: "empty",
    async interpret(request) {
      return {
        requestId: request.requestId,
        provider: "empty",
        model: "fixture",
        task: request.task,
        schemaVersion: request.schemaVersion,
        candidates: [],
        sourceReferences: [request.sourceId],
        warnings: [],
        validationIssues: [],
        createdAt: new Date("2026-01-01T00:00:00Z"),
      };
    },
  };
}

function source(overrides: Partial<Parameters<typeof IntakeSource.create>[0]> = {}) {
  return IntakeSource.create({
    sourceId: "interview-1",
    tenantId: "tenant-a",
    companyId: "company-a",
    sourceType: "MANAGER_INTERVIEW",
    title: "Manager interview",
    origin: "manual://interview-1",
    rawText: "When the BT arrives, ADV checks it and sends it to Marc before ERP entry.",
    metadata: { sourceVersion: "1" },
    ...overrides,
  });
}

function session(overrides: Partial<Parameters<typeof IntakeSession.create>[0]> = {}) {
  return IntakeSession.create({
    sessionId: "session-1",
    tenantId: "tenant-a",
    companyId: "company-a",
    ...overrides,
  });
}
