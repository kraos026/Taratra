import { describe, expect, it } from "vitest";
import {
  InMemoryLiveAITransport,
  OpenAICompatibleSyntheticTransport,
  LiveSyntheticAIProvider,
  readLiveSyntheticAIConfig,
  resolveProviderRequestCapabilities,
  serializeActorPerspective,
  SyntheticLiveAIError,
  validatePerspectiveOutput,
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

  it("normalizes Kimi K3 without temperature and with max_completion_tokens", () => {
    const capabilities = resolveProviderRequestCapabilities("kimi", "kimi-k3");
    expect(capabilities.supportsTemperature).toBe(false);
    expect(capabilities.maxTokenField).toBe("max_completion_tokens");
    expect(capabilities.reasoningEffort).toBe("low");
    expect(capabilities.defaultCompletionBudget).toBe(8192);
    expect(resolveProviderRequestCapabilities("openai", "gpt-test").maxTokenField).toBe(
      "max_tokens",
    );
    expect(
      resolveProviderRequestCapabilities("openai", "gpt-test").reasoningEffort,
    ).toBeUndefined();
  });

  it("routes Kimi K2.6 to bounded plain non-thinking expressions", () => {
    const capabilities = resolveProviderRequestCapabilities("kimi", "kimi-k2.6");
    expect(capabilities.thinkingMode).toBe("DISABLED");
    expect(capabilities.expressionFormat).toBe("PLAIN");
    expect(capabilities.requiredTemperature).toBe(0.6);
    expect(capabilities.defaultCompletionBudget).toBe(1024);
    expect(capabilities.supportsStructuredOutput).toBe(false);
  });

  it("does not retry an invalid HTTP 400", async () => {
    let calls = 0;
    const transport = new InMemoryLiveAITransport(() => {
      calls += 1;
      throw new SyntheticLiveAIError("PROVIDER_ERROR", "Live provider HTTP 400");
    });
    const provider = new LiveSyntheticAIProvider(transport, config({ maxRetries: 2 }));
    await expect(provider.interpret(request)).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
    expect(calls).toBe(1);
  });

  it("distinguishes an authorized unknown from an asserted unknown fact", () => {
    const unknown = { knownClaims: ["orders are copied"], knownUnknowns: ["monthly volume"] };
    expect(validatePerspectiveOutput("I don't know the monthly volume.", unknown)).toEqual([]);
    expect(validatePerspectiveOutput("The monthly volume is 900.", unknown)).toContain(
      "UNAUTHORIZED_FACT",
    );
  });

  it("rejects invented timeframe, frequency, causal and organizational details", () => {
    const allowed = { knownClaims: ["orders are copied"], knownUnknowns: [] };
    expect(validatePerspectiveOutput("Orders are copied every Monday.", allowed)).toContain(
      "OUT_OF_SCOPE_ASSERTION",
    );
    expect(
      validatePerspectiveOutput("Orders are copied because the ERP fails.", allowed),
    ).toContain("OUT_OF_SCOPE_ASSERTION");
    expect(validatePerspectiveOutput("The finance team approves each order.", allowed)).toContain(
      "OUT_OF_SCOPE_ASSERTION",
    );
    expect(validatePerspectiveOutput("The monthly volume is 900.", allowed)).toContain(
      "INVENTED_METRIC",
    );
  });

  it("regenerates semantically with a sanitized correction and never forwards GroundTruth", async () => {
    let calls = 0;
    const transport = new InMemoryLiveAITransport((input) => {
      calls += 1;
      expect(input.request).not.toHaveProperty("knownUnknowns");
      expect(input.request.sourceText).not.toContain("GroundTruth");
      return {
        result: result(
          calls === 1 ? "The monthly volume is 900." : "I don't know the monthly volume.",
        ),
      };
    });
    const provider = new LiveSyntheticAIProvider(transport, config({ maxRetries: 1 }));
    await expect(
      provider.interpret({ ...request, knownUnknowns: ["monthly volume"] }),
    ).resolves.toBeDefined();
    expect(calls).toBe(2);
    expect(provider.usage.semanticRegenerations).toBe(1);
    expect(transport.requests[1]?.request.sourceText).toContain("Regeneration correction");
  });

  it("emits the normalized Kimi request fields", async () => {
    let body: Record<string, unknown> | undefined;
    const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  expressionId: "e-1",
                  task: "INTERVIEW",
                  content: "A bounded expression.",
                  language: "en",
                  speakerRole: "OPERATOR",
                  claims: [],
                  unknowns: [],
                  terminology: {},
                  warnings: [],
                }),
              },
            },
          ],
        }),
        {
          status: 200,
        },
      );
    };
    const transport = new OpenAICompatibleSyntheticTransport(
      "https://example.invalid",
      "secret",
      fetcher,
    );
    await transport.complete({
      request,
      prompt: { kind: "INTERVIEW", version: "1", system: "bounded" },
      config: config({ provider: "kimi", model: "kimi-k3" }),
      capabilities: resolveProviderRequestCapabilities("kimi", "kimi-k3"),
    });
    expect(body).not.toHaveProperty("temperature");
    expect(body).toHaveProperty("max_completion_tokens");
    expect(body).not.toHaveProperty("max_tokens");
    expect(body).toHaveProperty("response_format.type", "json_schema");
    expect(body).toHaveProperty("reasoning_effort", "low");
  });

  it("emits Kimi K2.6 thinking disabled and parses plain content without reasoning", async () => {
    let body: Record<string, unknown> | undefined;
    const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "Orders are copied manually." } }],
          usage: { prompt_tokens: 10, completion_tokens: 8 },
        }),
        { status: 200 },
      );
    };
    const transport = new OpenAICompatibleSyntheticTransport(
      "https://example.invalid",
      "secret",
      fetcher,
    );
    const response = await transport.complete({
      request: { ...request, speakerRole: "MANAGER" },
      prompt: { kind: "INTERVIEW", version: "1", system: "bounded" },
      config: config({ provider: "kimi", model: "kimi-k2.6", structuredOutput: true }),
      capabilities: resolveProviderRequestCapabilities("kimi", "kimi-k2.6"),
    });
    expect(body).toHaveProperty("thinking.type", "disabled");
    expect(body).toHaveProperty("max_completion_tokens", 1024);
    expect(body).not.toHaveProperty("max_tokens");
    expect(body).not.toHaveProperty("response_format");
    expect(response.result?.candidates[0]?.statement).toBe("Orders are copied manually.");
    expect(response.result).not.toHaveProperty("reasoning_content");
  });
});
