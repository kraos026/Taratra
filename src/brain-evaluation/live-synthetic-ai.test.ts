import { describe, expect, it } from "vitest";
import {
  InMemoryLiveAITransport,
  LiveSyntheticAIProvider,
  readLiveSyntheticAIConfig,
  serializeActorPerspective,
  SyntheticLiveAIError,
} from "./live-synthetic-ai";
import type { AIInterpretationResult } from "./ai-interpretation-gateway";

const request = {
  requestId: "r-1",
  tenantId: "synthetic-tenant",
  sourceId: "source-1",
  sourceType: "INTERVIEW",
  sourceText: "Orders are copied manually.",
  task: "PROCESS_OBSERVATION",
  schemaVersion: "synthetic-realism-v1",
  knownClaims: ["orders are copied manually"],
  knownUnknowns: ["secret root cause"],
};

const result = (statement: string): AIInterpretationResult => ({
  requestId: request.requestId,
  provider: "fixture",
  model: "fixture",
  task: request.task,
  schemaVersion: request.schemaVersion,
  candidates: [
    {
      candidateId: "c-1",
      candidateType: "PROCESS_OBSERVATION_CANDIDATE",
      statement,
      sourceReference: `${request.sourceId}:1`,
      sourceExcerpt: request.sourceText,
      rationale: "fixture",
      knowledgeReferences: [],
      status: "AI_DERIVED",
      review: "REQUIRED",
    },
  ],
  sourceReferences: [request.sourceId],
  warnings: [],
  validationIssues: [],
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
});

const config = (overrides: Partial<ReturnType<typeof readLiveSyntheticAIConfig>> = {}) => ({
  ...readLiveSyntheticAIConfig({ AUTOMATEX_LIVE_SYNTHETIC_AI: "true", AUTOMATEX_AI_MODEL: "test" }),
  ...overrides,
});

describe("LiveSyntheticAIProvider", () => {
  it("is disabled by default and exposes no secret values", async () => {
    const provider = new LiveSyntheticAIProvider(
      new InMemoryLiveAITransport(() => ({ result: result("safe") })),
      readLiveSyntheticAIConfig({}),
    );
    await expect(provider.interpret(request)).rejects.toMatchObject({ code: "DISABLED" });
  });

  it("passes only bounded request data to the injected transport", async () => {
    const transport = new InMemoryLiveAITransport((input) => {
      void input;
      return { result: result("Orders are copied manually.") };
    });
    const provider = new LiveSyntheticAIProvider(transport, config());
    await provider.interpret(request);
    expect(transport.requests[0]?.request).not.toHaveProperty("_groundTruth");
    expect(transport.requests[0]?.request).not.toHaveProperty("knownUnknowns");
    expect(transport.requests[0]?.request).not.toHaveProperty("expectedDecision");
    expect(
      JSON.stringify(
        serializeActorPerspective({
          actorId: "a",
          role: "OPERATOR",
          knowledgeScope: ["orders"],
          beliefs: {},
          bias: 0,
          reliability: 1,
          confidence: 1,
          informationFreshness: 1,
          knownFacts: ["orders"],
          unknownFacts: ["secret root cause"],
          terminology: {},
          communicationStyle: "DIRECT",
          language: "en",
        }),
      ),
    ).not.toContain("groundTruth");
  });

  it("rejects perspective violations and bounds retries", async () => {
    let calls = 0;
    const transport = new InMemoryLiveAITransport(() => {
      calls += 1;
      return { result: result("The secret root cause is known.") };
    });
    const provider = new LiveSyntheticAIProvider(transport, config({ maxRetries: 2 }));
    await expect(provider.interpret(request)).rejects.toBeInstanceOf(SyntheticLiveAIError);
    expect(calls).toBe(3);
    expect(provider.usage.retries).toBe(0);
  });

  it("reuses the existing provider boundary for a valid result", async () => {
    const provider = new LiveSyntheticAIProvider(
      new InMemoryLiveAITransport(() => ({ result: result("Orders are copied manually.") })),
      config(),
    );
    const output = await provider.interpret(request);
    expect(output.candidates[0]?.sourceReference).toBe("source-1:1");
  });
});
