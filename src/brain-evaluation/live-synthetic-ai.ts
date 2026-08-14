import type {
  AIInterpretationRequest,
  AIInterpretationResult,
  AIProvider,
} from "./ai-interpretation-gateway";
import type { ActorPerspective, DocumentPerspective } from "./synthetic-realism";
import {
  parseSyntheticExpressionEnvelope,
  SyntheticExpressionParseError,
  type SyntheticExpressionEnvelope,
} from "./synthetic-expression-contract";

export type SyntheticPromptKind =
  "INTERVIEW" | "FOLLOW_UP" | "EMAIL" | "SOP" | "MEETING_NOTES" | "PROCESS_DESCRIPTION";

export interface SyntheticPromptContract {
  readonly kind: SyntheticPromptKind;
  readonly version: string;
  readonly system: string;
}

export const SYNTHETIC_PROMPT_CONTRACTS: Readonly<
  Record<SyntheticPromptKind, SyntheticPromptContract>
> = Object.freeze({
  INTERVIEW: Object.freeze({
    kind: "INTERVIEW",
    version: "2",
    system:
      "Return exactly one JSON object matching the synthetic expression envelope. Put natural-language business expression only in content. Do not output commentary. Do not invent metrics, systems, or policies. Stay within the supplied perspective, express beliefs as beliefs, and preserve uncertainty.",
  }),
  FOLLOW_UP: Object.freeze({
    kind: "FOLLOW_UP",
    version: "2",
    system:
      "Return exactly one JSON object matching the synthetic expression envelope. Put the follow-up answer only in content. Do not output commentary or invent facts, metrics, systems, or policies. Preserve uncertainty and beliefs.",
  }),
  EMAIL: Object.freeze({
    kind: "EMAIL",
    version: "2",
    system:
      "Return exactly one JSON object matching the synthetic expression envelope. Put email prose only in content. Do not output commentary or invent facts, metrics, systems, or policies.",
  }),
  SOP: Object.freeze({
    kind: "SOP",
    version: "2",
    system:
      "Return exactly one JSON object matching the synthetic expression envelope. Put SOP prose only in content. Do not output commentary or invent facts, metrics, or policies.",
  }),
  MEETING_NOTES: Object.freeze({
    kind: "MEETING_NOTES",
    version: "2",
    system:
      "Return exactly one JSON object matching the synthetic expression envelope. Put meeting notes only in content. Preserve uncertainty and do not invent facts, metrics, systems, or policies.",
  }),
  PROCESS_DESCRIPTION: Object.freeze({
    kind: "PROCESS_DESCRIPTION",
    version: "2",
    system:
      "Return exactly one JSON object matching the synthetic expression envelope. Put process prose only in content. Do not output commentary or invent facts, metrics, systems, or policies.",
  }),
});

export interface LiveSyntheticAIConfig {
  readonly provider: string;
  readonly model: string;
  readonly temperature: number;
  readonly timeoutMs: number;
  readonly maxOutputTokens: number;
  readonly maxRetries: number;
  readonly structuredOutput: boolean;
  readonly enabled: boolean;
}

export interface LiveAICompletionRequest {
  readonly request: AIInterpretationRequest;
  readonly prompt: SyntheticPromptContract;
  readonly config: LiveSyntheticAIConfig;
  readonly capabilities: ProviderRequestCapabilities;
}

export interface ProviderRequestCapabilities {
  readonly supportsTemperature: boolean;
  readonly requiredTemperature?: number;
  readonly maxTokenField: "max_tokens" | "max_completion_tokens";
  readonly supportsStructuredOutput: boolean;
  readonly supportsReasoningEffort: boolean;
}

export function resolveProviderRequestCapabilities(
  provider: string,
  model: string,
): ProviderRequestCapabilities {
  if (provider.toLowerCase() === "kimi" && model === "kimi-k3")
    return Object.freeze({
      supportsTemperature: false,
      maxTokenField: "max_completion_tokens",
      supportsStructuredOutput: true,
      supportsReasoningEffort: false,
    });
  return Object.freeze({
    supportsTemperature: true,
    maxTokenField: "max_tokens",
    supportsStructuredOutput: true,
    supportsReasoningEffort: false,
  });
}

export interface LiveAICompletionResponse {
  readonly result?: AIInterpretationResult;
  readonly expression?: SyntheticExpressionEnvelope;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly latencyMs?: number;
  readonly estimatedCost?: number;
}

export interface LiveAITransport {
  complete(request: LiveAICompletionRequest): Promise<LiveAICompletionResponse>;
}

/** OpenAI-compatible infrastructure adapter. It is never used unless explicitly enabled. */
export class OpenAICompatibleSyntheticTransport implements LiveAITransport {
  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async complete(input: LiveAICompletionRequest): Promise<LiveAICompletionResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.config.timeoutMs);
    const started = Date.now();
    try {
      const response = await this.fetcher(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: input.config.model,
          ...(input.capabilities.supportsTemperature
            ? { temperature: input.config.temperature }
            : input.capabilities.requiredTemperature !== undefined
              ? { temperature: input.capabilities.requiredTemperature }
              : {}),
          [input.capabilities.maxTokenField]: input.config.maxOutputTokens,
          ...(input.config.structuredOutput && input.capabilities.supportsStructuredOutput
            ? { response_format: { type: "json_object" } }
            : {}),
          messages: [
            { role: "system", content: input.prompt.system },
            { role: "user", content: input.request.sourceText },
          ],
        }),
        signal: controller.signal,
      });
      if (!response.ok)
        throw new SyntheticLiveAIError("PROVIDER_ERROR", `Live provider HTTP ${response.status}`);
      const payload = (await response.json()) as {
        choices?: readonly { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content)
        throw new SyntheticLiveAIError("INVALID_OUTPUT", "Live provider returned no content");
      let expression: SyntheticExpressionEnvelope;
      try {
        expression = parseSyntheticExpressionEnvelope(content, input.request.speakerRole);
      } catch (error) {
        if (error instanceof SyntheticExpressionParseError)
          throw new SyntheticLiveAIError("INVALID_OUTPUT", error.code);
        throw error;
      }
      return {
        expression,
        inputTokens: payload.usage?.prompt_tokens,
        outputTokens: payload.usage?.completion_tokens,
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      if (error instanceof SyntheticLiveAIError) throw error;
      if (error instanceof DOMException && error.name === "AbortError")
        throw new SyntheticLiveAIError("TIMEOUT", "Live provider request timed out");
      throw new SyntheticLiveAIError("PROVIDER_ERROR", "Live provider request failed");
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createConfiguredLiveSyntheticProvider(
  env: Partial<NodeJS.ProcessEnv> = process.env,
  fetcher: typeof fetch = fetch,
): LiveSyntheticAIProvider {
  const config = readLiveSyntheticAIConfig(env);
  const endpoint = env.AUTOMATEX_AI_ENDPOINT;
  const key = env.AUTOMATEX_AI_API_KEY;
  if (!config.enabled || !endpoint || !key)
    throw new SyntheticLiveAIError(
      "DISABLED",
      "Live synthetic AI requires explicit provider configuration",
    );
  return new LiveSyntheticAIProvider(
    new OpenAICompatibleSyntheticTransport(endpoint, key, fetcher),
    config,
  );
}

export interface LiveAIUsage {
  readonly requests: number;
  readonly retries: number;
  readonly latencyMs: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCost?: number;
}

export type PerspectiveViolation =
  | "GROUND_TRUTH_LEAK"
  | "UNAUTHORIZED_FACT"
  | "INVENTED_METRIC"
  | "INVENTED_SYSTEM"
  | "INVENTED_POLICY"
  | "OUT_OF_SCOPE_ASSERTION"
  | "PERSPECTIVE_CONTRADICTION";

export function validatePerspectiveOutput(
  text: string,
  request: Pick<AIInterpretationRequest, "knownClaims" | "knownUnknowns">,
): readonly PerspectiveViolation[] {
  const lower = text.toLowerCase();
  const violations = new Set<PerspectiveViolation>();
  if (
    /(?:_groundtruth|expectedrootcause|expecteddecision|hiddensystemcapabilities|evaluationexpectation)/i.test(
      text,
    )
  )
    violations.add("GROUND_TRUTH_LEAK");
  if ((request.knownUnknowns ?? []).some((fact) => lower.includes(fact.toLowerCase()))) {
    violations.add("UNAUTHORIZED_FACT");
    violations.add("OUT_OF_SCOPE_ASSERTION");
  }
  const numbers = [...text.matchAll(/\b\d+(?:\.\d+)?\b/g)].map((match) => match[0]);
  if (
    numbers.length &&
    !(request.knownClaims ?? []).some((claim) => numbers.some((value) => claim.includes(value)))
  )
    violations.add("INVENTED_METRIC");
  if (/\b(?:the system|our platform) knows the hidden|approved by policy\b/i.test(text)) {
    violations.add("INVENTED_SYSTEM");
    violations.add("INVENTED_POLICY");
  }
  return Object.freeze([...violations]);
}

export class SyntheticLiveAIError extends Error {
  constructor(
    readonly code:
      "DISABLED" | "TIMEOUT" | "INVALID_OUTPUT" | "PERSPECTIVE_VIOLATION" | "PROVIDER_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "SyntheticLiveAIError";
  }
}

export function readLiveSyntheticAIConfig(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): LiveSyntheticAIConfig {
  const number = (name: string, fallback: number, min: number) => {
    const value = Number(env[name] ?? fallback);
    return Number.isFinite(value) && value >= min ? value : fallback;
  };
  return Object.freeze({
    provider: env.AUTOMATEX_AI_PROVIDER ?? "openai-compatible",
    model: env.AUTOMATEX_AI_MODEL ?? "",
    temperature: Math.min(2, number("AUTOMATEX_AI_TEMPERATURE", 0.4, 0)),
    timeoutMs: number("AUTOMATEX_AI_TIMEOUT_MS", 20_000, 100),
    maxOutputTokens: number("AUTOMATEX_AI_MAX_OUTPUT_TOKENS", 800, 1),
    maxRetries: Math.min(2, Math.floor(number("AUTOMATEX_AI_MAX_RETRIES", 2, 0))),
    structuredOutput: env.AUTOMATEX_AI_STRUCTURED_OUTPUT !== "false",
    enabled: env.AUTOMATEX_LIVE_SYNTHETIC_AI === "true",
  });
}

function expressionToInterpretation(
  expression: SyntheticExpressionEnvelope,
  request: AIInterpretationRequest,
  provider: string,
  model: string,
): AIInterpretationResult {
  return Object.freeze({
    requestId: request.requestId,
    provider,
    model,
    task: request.task,
    schemaVersion: request.schemaVersion,
    candidates: Object.freeze([
      Object.freeze({
        candidateId: expression.expressionId,
        candidateType: "PROCESS_OBSERVATION_CANDIDATE" as const,
        statement: expression.content,
        sourceReference: `${request.sourceId}:1`,
        sourceExcerpt: expression.content.slice(0, 160),
        rationale: "Synthetic expression envelope",
        knowledgeReferences: Object.freeze([]),
        status: "AI_DERIVED" as const,
        review: "REQUIRED" as const,
      }),
    ]),
    sourceReferences: Object.freeze([request.sourceId]),
    warnings: Object.freeze([...expression.warnings]),
    validationIssues: Object.freeze([]),
    createdAt: new Date(),
  });
}

/** Adapter only: secrets stay in the injected transport and are never logged or returned. */
export class LiveSyntheticAIProvider implements AIProvider {
  readonly providerId: string;
  private usageValue: LiveAIUsage = Object.freeze({
    requests: 0,
    retries: 0,
    latencyMs: 0,
    inputTokens: 0,
    outputTokens: 0,
  });
  private readonly capabilities: ProviderRequestCapabilities;

  constructor(
    private readonly transport: LiveAITransport,
    private readonly config: LiveSyntheticAIConfig,
    private readonly promptKind: SyntheticPromptKind = "INTERVIEW",
  ) {
    this.providerId = `live-synthetic:${config.provider}`;
    this.capabilities = resolveProviderRequestCapabilities(config.provider, config.model);
  }

  get usage(): LiveAIUsage {
    return this.usageValue;
  }

  async interpret(request: AIInterpretationRequest): Promise<AIInterpretationResult> {
    if (!this.config.enabled)
      throw new SyntheticLiveAIError("DISABLED", "Live synthetic AI is disabled");
    if (!this.config.model)
      throw new SyntheticLiveAIError("DISABLED", "Live synthetic AI model is not configured");
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      const started = Date.now();
      try {
        const {
          knownClaims: _knownClaims,
          knownUnknowns: _knownUnknowns,
          ...safeRequest
        } = request;
        void _knownClaims;
        void _knownUnknowns;
        // Validator-only fields are intentionally omitted from the live request.
        const providerRequest: AIInterpretationRequest = safeRequest;
        const response = await this.transport.complete({
          request: providerRequest,
          prompt: SYNTHETIC_PROMPT_CONTRACTS[this.promptKind],
          config: this.config,
          capabilities: this.capabilities,
        });
        const result = this.validatePerspective(
          response.result ??
            expressionToInterpretation(
              response.expression!,
              request,
              this.providerId,
              this.config.model,
            ),
          request,
        );
        this.usageValue = Object.freeze({
          requests: this.usageValue.requests + 1,
          retries: this.usageValue.retries + attempt,
          latencyMs: this.usageValue.latencyMs + (response.latencyMs ?? Date.now() - started),
          inputTokens: this.usageValue.inputTokens + (response.inputTokens ?? 0),
          outputTokens: this.usageValue.outputTokens + (response.outputTokens ?? 0),
          estimatedCost: response.estimatedCost,
        });
        return result;
      } catch (error) {
        lastError = error;
        if (
          error instanceof SyntheticLiveAIError &&
          error.code === "PROVIDER_ERROR" &&
          /HTTP 4\d\d/.test(error.message)
        )
          break;
        if (attempt === this.config.maxRetries) break;
      }
    }
    throw lastError instanceof SyntheticLiveAIError
      ? lastError
      : new SyntheticLiveAIError("PROVIDER_ERROR", "Live synthetic provider failed");
  }

  private validatePerspective(
    result: AIInterpretationResult,
    request: AIInterpretationRequest,
  ): AIInterpretationResult {
    const text = result.candidates
      .map((candidate) => candidate.statement)
      .join(" ")
      .toLowerCase();
    const violations = validatePerspectiveOutput(text, request);
    if (violations.length)
      throw new SyntheticLiveAIError("PERSPECTIVE_VIOLATION", violations.join(","));
    return Object.freeze({ ...result });
  }
}

/** Explicit test transport; it never performs network I/O. */
export class InMemoryLiveAITransport implements LiveAITransport {
  readonly requests: LiveAICompletionRequest[] = [];
  constructor(
    private readonly responder: (request: LiveAICompletionRequest) => LiveAICompletionResponse,
  ) {}
  complete(request: LiveAICompletionRequest): Promise<LiveAICompletionResponse> {
    this.requests.push(request);
    return Promise.resolve(this.responder(request));
  }
}

export function serializeActorPerspective(
  perspective: ActorPerspective,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    actorId: perspective.actorId,
    role: perspective.role,
    knowledgeScope: [...perspective.knowledgeScope],
    beliefs: { ...perspective.beliefs },
    bias: perspective.bias,
    reliability: perspective.reliability,
    confidence: perspective.confidence,
    informationFreshness: perspective.informationFreshness,
    knownFacts: [...perspective.knownFacts],
    unknownFacts: [...perspective.unknownFacts],
    terminology: { ...perspective.terminology },
    communicationStyle: perspective.communicationStyle,
    language: perspective.language,
  });
}

export function serializeDocumentPerspective(
  perspective: DocumentPerspective,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    documentId: perspective.documentId,
    documentType: perspective.documentType,
    allowedFacts: [...perspective.allowedFacts],
    unknownFacts: [...perspective.unknownFacts],
    terminology: { ...perspective.terminology },
    freshness: perspective.freshness,
    language: perspective.language,
  });
}
