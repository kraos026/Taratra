import { describe, expect, it } from "vitest";

import { runCanonicalShadowBenchmark } from "./canonical-shadow-benchmark";
import { canonicalShadowCases } from "./canonical-shadow-scenarios";
import {
  applyBrainKimiRoiAuthorityGate,
  BrainKimiBenchmarkAdapter,
  calculateBrainKimiSafetyMetrics,
  createConfiguredBrainKimiBenchmarkProvider,
  evaluateEconomicSufficiency,
  parseBrainKimiProviderResult,
  runBrainKimiBenchmarkExperiment,
} from "./canonical-shadow-kimi-adapter";
import { scoreBrainSnapshot } from "./canonical-shadow-scorer";
import { SyntheticLiveAIError } from "./live-synthetic-ai";
import type { BrainKimiNormalizedOutput } from "./canonical-shadow-kimi-adapter";
import type {
  AICandidate,
  AIInterpretationRequest,
  AIInterpretationResult,
  AIProvider,
} from "./ai-interpretation-gateway";
import type { BenchmarkPublicInput } from "./canonical-shadow-types";

describe("Brain+Kimi benchmark adapter", () => {
  it("passes only public benchmark input to the provider", async () => {
    const benchmarkCase = caseById("broken_quality_rework_loop");
    const hidden = JSON.stringify(benchmarkCase.hiddenGroundTruth);
    const scorer = JSON.stringify(benchmarkCase.scoringMetadata);
    const provider = new CapturingProvider(validOutput());
    const adapter = new BrainKimiBenchmarkAdapter(provider, { model: "kimi-k3" });

    await adapter.analyze(benchmarkCase.publicInput);

    expect(provider.lastRequest).toBeTruthy();
    const payload = JSON.stringify(provider.lastRequest);
    expect(payload).toContain("broken_quality_rework_loop");
    expect(payload).not.toContain("hiddenGroundTruth");
    expect(payload).not.toContain("scoringMetadata");
    expect(payload).not.toContain("expectedFindings");
    expect(payload).not.toContain("forbiddenInventions");
    expect(payload).not.toContain("expectedOutcome");
    expect(payload).not.toContain("promotion");
    for (const conceptId of conceptIds(hidden)) expect(payload).not.toContain(conceptId);
    expect(scorer).toContain("aliases");
    expect(payload).not.toContain("aliases");
  });

  it("does not pass canonical snapshots or benchmark scores to Kimi", async () => {
    const provider = new CapturingProvider(validOutput());
    const adapter = new BrainKimiBenchmarkAdapter(provider);

    await adapter.analyze(caseById("finance_hours_conflict").publicInput);

    const payload = JSON.stringify(provider.lastRequest);
    expect(payload).not.toContain("canonicalSnapshot");
    expect(payload).not.toContain("canonicalScore");
    expect(payload).not.toContain("brainOnlyScore");
    expect(payload).not.toContain("hybridScore");
    expect(payload).not.toContain("BenchmarkScore");
  });

  it("classifies provider failures explicitly without deterministic fallback", async () => {
    const provider = new ThrowingProvider(new SyntheticLiveAIError("TIMEOUT", "timed out"));
    const adapter = new BrainKimiBenchmarkAdapter(provider, { model: "kimi-k3" });

    const result = await adapter.analyze(caseById("low_volume_board_pack").publicInput);

    expect(result.snapshot).toBeNull();
    expect(result.failure?.code).toBe("TIMEOUT");
    expect(result.telemetry.providerFailure?.code).toBe("TIMEOUT");
  });

  it("classifies missing live provider configuration as CONFIG_FAILURE", async () => {
    const provider = new ThrowingProvider(new SyntheticLiveAIError("DISABLED", "missing config"));
    const adapter = new BrainKimiBenchmarkAdapter(provider);

    const result = await adapter.analyze(caseById("supplier_payment_fraud_risk").publicInput);

    expect(result.failure?.code).toBe("CONFIG_FAILURE");
    expect(result.snapshot).toBeNull();
  });

  it("rejects invalid JSON provider output", () => {
    expect(() =>
      parseBrainKimiProviderResult(
        interpretationResult("not JSON at all", "brain-kimi:invalid-json"),
      ),
    ).toThrow(/Provider did not return JSON/);
  });

  it("blocks unsupported ROI in normalized Brain+Kimi output", async () => {
    const benchmarkCase = caseById("missing_volume_duration_estimates");
    const provider = new CapturingProvider({
      ...validOutput(),
      recommendedOutcome: "AUTOMATE_NOW",
      opportunities: ["Automate the workflow immediately"],
      roiAssessment: {
        direction: "POSITIVE",
        numericClaims: ["Save 42 percent next month"],
        missingInputs: [],
        evidenceRefs: [],
        confidence: 0.91,
      },
      confidence: 0.91,
    });
    const adapter = new BrainKimiBenchmarkAdapter(provider);

    const result = await adapter.analyze(benchmarkCase.publicInput);
    const score = scoreBrainSnapshot(benchmarkCase, result.snapshot!);
    const metrics = calculateBrainKimiSafetyMetrics(benchmarkCase, result.snapshot!, score);

    expect(result.snapshot?.economicAssessment.direction).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.snapshot?.economicAssessment.numericClaims).toEqual([]);
    expect(result.snapshot?.economicAssessment.missingInputs.length).toBeGreaterThan(0);
    expect(result.snapshot?.critiques.join(" ")).toContain("withheld from ROI authority");
    expect(metrics.unsupportedRoi).toBe(0);
    expect(metrics.unsafeAutomation).toBe(1);
  });

  it.each([
    ["broken_quality_rework_loop", ["140 defects/week", "11 admin hours/week"]],
    ["prohibited_tool_dependency", ["95 quotes per month", "18 minutes prep time per quote"]],
    ["revenue_gain_no_baseline", ["400 leads per month"]],
    ["finance_hours_conflict", ["80 hours/month", "20 hours/month"]],
    ["known_cost_unknown_volume", ["Vendor implementation cost: 18000"]],
  ])("keeps %s operational numbers outside ROI authority", async (caseId, numericClaims) => {
    const benchmarkCase = caseById(caseId);
    const provider = new CapturingProvider({
      ...validOutput(),
      claims: numericClaims.map((value) => `Operational observation: ${value}`),
      roiAssessment: {
        direction: "POSITIVE",
        numericClaims,
        missingInputs: [],
        evidenceRefs: [],
        confidence: 0.9,
      },
    });

    const result = await new BrainKimiBenchmarkAdapter(provider).analyze(benchmarkCase.publicInput);
    const text = result.snapshot?.claims.map((claim) => claim.statement).join(" ") ?? "";

    expect(result.snapshot?.economicAssessment.direction).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.snapshot?.economicAssessment.numericClaims).toEqual([]);
    for (const value of numericClaims) expect(text).toContain(value);
  });

  it("allows numeric economics only when all sufficiency inputs are present", () => {
    const publicInput = supportedEconomicInput();
    const output: BrainKimiNormalizedOutput = {
      ...validOutput(),
      roiAssessment: {
        direction: "POSITIVE",
        numericClaims: ["Annual savings net of recurring cost is 12000"],
        missingInputs: [],
        evidenceRefs: ["economic-1"],
        confidence: 0.82,
      },
    };

    const sufficiency = evaluateEconomicSufficiency(publicInput);
    const gated = applyBrainKimiRoiAuthorityGate(publicInput, output);

    expect(sufficiency.sufficientForAuthoritativeNumericEconomics).toBe(true);
    expect(gated.roiAssessment.direction).toBe("POSITIVE");
    expect(gated.roiAssessment.numericClaims).toEqual([
      "Annual savings net of recurring cost is 12000",
    ]);
  });

  it("normalizes human-review outputs into risk critiques", async () => {
    const benchmarkCase = caseById("hr_personal_data_request");
    const provider = new CapturingProvider({
      ...validOutput(),
      recommendedOutcome: "DO_NOT_AUTOMATE",
      opportunities: ["Do not automate HR personal data decisions"],
      risks: ["Sensitive HR personal data requires explicit control"],
      humanReviewRequirements: ["Human review and HR approval are mandatory"],
      roiAssessment: {
        direction: "INSUFFICIENT_EVIDENCE",
        numericClaims: [],
        missingInputs: ["privacy approval"],
        evidenceRefs: [],
        confidence: 0.6,
      },
    });

    const result = await new BrainKimiBenchmarkAdapter(provider).analyze(benchmarkCase.publicInput);

    expect(result.snapshot?.critiques.join(" ")).toMatch(/Human review|HR approval/i);
    expect(result.snapshot?.opportunityDecisions[0]?.decision).toBe("REJECT");
  });

  it("normalizes remediation-first outputs without mutating production benchmark arms", async () => {
    const benchmarkCase = caseById("training_gap_service_dispatch");
    const before = runCanonicalShadowBenchmark({
      caseIds: [benchmarkCase.publicInput.caseId],
      codeSha: "fixed-sha",
    });
    const provider = new CapturingProvider({
      ...validOutput(),
      recommendedOutcome: "AUTOMATE_AFTER_REMEDIATION",
      opportunities: ["Assist service dispatch after training cleanup"],
      remediationSteps: ["Fix training documentation before automation"],
      roiAssessment: {
        direction: "STRATEGIC_NON_QUANTIFIED",
        numericClaims: [],
        missingInputs: ["post-remediation baseline"],
        evidenceRefs: [],
        confidence: 0.62,
      },
    });

    const result = await new BrainKimiBenchmarkAdapter(provider).analyze(benchmarkCase.publicInput);
    const after = runCanonicalShadowBenchmark({
      caseIds: [benchmarkCase.publicInput.caseId],
      codeSha: "fixed-sha",
    });

    expect(result.snapshot?.opportunityDecisions[0]?.decision).toBe("RECOMMEND");
    expect(result.snapshot?.critiques.join(" ")).toContain("training documentation");
    expect(after).toEqual(before);
    expect(after.perCase[0]).not.toHaveProperty("brainKimiSnapshot");
  });

  it("runs the Arm D experiment on the 20 difficult V3 cases only", async () => {
    const provider = new CapturingProvider(validOutput());

    const result = await runBrainKimiBenchmarkExperiment({ provider, model: "kimi-k3" });

    expect(result.caseCount).toBe(20);
    expect(result.perCase.map((item) => item.caseId)).not.toContain("manual_invoice_processing");
    expect(result.providerFailures).toBe(0);
    expect(result.brainKimiSafetyMetrics).toBeTruthy();
  });

  it("configures the existing live provider with the benchmark-analysis prompt", async () => {
    let body: Record<string, unknown> | null = null;
    const provider = createConfiguredBrainKimiBenchmarkProvider(
      {
        AUTOMATEX_LIVE_SYNTHETIC_AI: "true",
        AUTOMATEX_AI_PROVIDER: "kimi",
        AUTOMATEX_AI_MODEL: "kimi-k2.6",
        AUTOMATEX_AI_ENDPOINT: "https://example.invalid/v1/chat/completions",
        AUTOMATEX_AI_API_KEY: "test-secret",
        AUTOMATEX_AI_REQUEST_DELAY_MS: "0",
      },
      async (_input, init) => {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(validOutput()) } }],
            usage: { prompt_tokens: 10, completion_tokens: 20 },
          }),
          { status: 200 },
        );
      },
    );

    const result = await new BrainKimiBenchmarkAdapter(provider, {
      model: "kimi-k2.6",
    }).analyze(caseById("supplier_payment_fraud_risk").publicInput);

    expect(result.failure).toBeNull();
    expect(result.snapshot).toBeTruthy();
    expect(JSON.stringify(body)).toContain("requested benchmark analysis schema");
    expect(JSON.stringify(body)).not.toContain("hiddenGroundTruth");
    expect(JSON.stringify(body)).not.toContain("test-secret");
  });
});

function caseById(caseId: string) {
  const benchmarkCase = canonicalShadowCases.find((item) => item.publicInput.caseId === caseId);
  if (!benchmarkCase) throw new Error(`Missing case ${caseId}`);
  return benchmarkCase;
}

function supportedEconomicInput(): BenchmarkPublicInput {
  const base = caseById("manual_invoice_processing").publicInput;
  return {
    ...base,
    caseId: "supported-economic-control",
    volumes: { invoicesPerMonth: 1000 },
    durations: { minutesPerInvoice: 6 },
    evidence: [
      ...base.evidence,
      {
        id: "economic-1",
        source: "finance model",
        statement:
          "The fully loaded labor cost is 45 per hour, implementation cost is 18000, recurring license maintenance cost is 900 per month, and expected reduction is 60 percent after adoption.",
        reliability: 0.95,
      },
    ],
  };
}

function validOutput(): BrainKimiNormalizedOutput {
  return {
    claims: ["Evidence is incomplete and automation should remain bounded"],
    rootCauses: ["Manual process instability is a possible cause"],
    bottlenecks: ["Approval or evidence collection is the bottleneck"],
    opportunities: ["Collect better evidence before automating"],
    recommendedOutcome: "NEEDS_MORE_EVIDENCE",
    deferredItems: ["Defer full automation"],
    rejectedItems: [],
    remediationSteps: ["Collect missing evidence"],
    missingEvidence: ["Validated baseline volume and duration"],
    contradictions: ["Some evidence is incomplete"],
    risks: ["Automation without evidence could be unsafe"],
    humanReviewRequirements: ["Human review required before production automation"],
    roiAssessment: {
      direction: "INSUFFICIENT_EVIDENCE",
      numericClaims: [],
      missingInputs: ["validated cost", "validated volume"],
      evidenceRefs: [],
      confidence: 0.55,
    },
    confidence: 0.58,
  };
}

class CapturingProvider implements AIProvider {
  readonly providerId = "test-kimi-provider";
  lastRequest: AIInterpretationRequest | null = null;
  usage = {
    providerAttempts: 0,
    latencyMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    rateLimitAttempts: 0,
    timeoutAttempts: 0,
  };

  constructor(private readonly output: unknown) {}

  async interpret(request: AIInterpretationRequest): Promise<AIInterpretationResult> {
    this.lastRequest = request;
    this.usage = {
      providerAttempts: this.usage.providerAttempts + 1,
      latencyMs: this.usage.latencyMs + 10,
      inputTokens: this.usage.inputTokens + request.sourceText.length,
      outputTokens: this.usage.outputTokens + 50,
      rateLimitAttempts: this.usage.rateLimitAttempts,
      timeoutAttempts: this.usage.timeoutAttempts,
    };
    return interpretationResult(JSON.stringify(this.output), request.requestId);
  }
}

class ThrowingProvider implements AIProvider {
  readonly providerId = "throwing-kimi-provider";

  constructor(private readonly error: Error) {}

  async interpret(): Promise<AIInterpretationResult> {
    throw this.error;
  }
}

function interpretationResult(statement: string, requestId: string): AIInterpretationResult {
  return Object.freeze({
    requestId,
    provider: "kimi",
    model: "kimi-k3",
    task: "BRAIN_KIMI_BENCHMARK",
    schemaVersion: "brain-kimi-benchmark-v1",
    candidates: Object.freeze([
      Object.freeze({
        candidateId: `${requestId}:candidate`,
        candidateType: "SUMMARY",
        statement,
        sourceReference: "benchmark-public-input:test:1",
        sourceExcerpt: statement.slice(0, 80),
        rationale: "fixture",
        knowledgeReferences: Object.freeze([]),
        status: "AI_DERIVED",
        review: "REQUIRED",
      } satisfies AICandidate),
    ]),
    sourceReferences: Object.freeze(["benchmark-public-input:test"]),
    warnings: Object.freeze([]),
    validationIssues: Object.freeze([]),
    createdAt: new Date("2026-08-27T00:00:00.000Z"),
  });
}

function conceptIds(hiddenJson: string): readonly string[] {
  return [...hiddenJson.matchAll(/"[a-z0-9]+(?:_[a-z0-9]+)+"/g)].map((match) =>
    match[0]!.replaceAll('"', ""),
  );
}
