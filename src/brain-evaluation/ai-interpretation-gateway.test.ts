import { describe, expect, it } from "vitest";
import {
  AIInterpretationGateway,
  AIOutputValidator,
  CandidateEvidencePromotionGate,
  DeterministicAIProvider,
  type AIInterpretationRequest,
} from "./ai-interpretation-gateway";

const request = (task = "FACT"): AIInterpretationRequest => ({
  requestId: "req-1",
  tenantId: "tenant-a",
  sourceId: "interview-1",
  sourceType: "INTERVIEW",
  sourceText: "We manually copy every order from CRM into ERP.",
  task,
  schemaVersion: "1",
  knownUnknowns: [],
  constraints: [],
});

describe("AI interpretation gateway", () => {
  it("returns source-grounded candidate", async () => {
    const result = await new AIInterpretationGateway(new DeterministicAIProvider()).interpret(
      request(),
    );
    expect(result.candidates[0]?.status).toBe("AI_DERIVED");
    expect(result.candidates[0]?.sourceReference).toContain("interview-1");
  });
  it("rejects hallucinated source references", async () => {
    await expect(
      new AIInterpretationGateway(new DeterministicAIProvider("hallucination")).interpret(
        request(),
      ),
    ).rejects.toThrow("source grounded");
  });
  it("rejects duplicate candidates", async () => {
    await expect(
      new AIInterpretationGateway(new DeterministicAIProvider("duplicate")).interpret(request()),
    ).rejects.toThrow("duplicate");
  });
  it("promotes direct fact only through the evidence gate", async () => {
    const result = await new AIInterpretationGateway(new DeterministicAIProvider()).interpret(
      request(),
    );
    expect(new CandidateEvidencePromotionGate().evaluate(result.candidates[0]!).outcome).toBe(
      "ACCEPT_AS_EVIDENCE",
    );
  });
  it("does not promote cause suggestions as evidence", async () => {
    const result = await new AIInterpretationGateway(new DeterministicAIProvider()).interpret(
      request("CAUSE"),
    );
    expect(new CandidateEvidencePromotionGate().evaluate(result.candidates[0]!).outcome).toBe(
      "NEED_VALIDATION",
    );
  });
  it("fails safely on provider timeout", async () => {
    await expect(
      new AIInterpretationGateway(new DeterministicAIProvider("timeout")).interpret(request()),
    ).rejects.toThrow("TIMEOUT");
  });
  it("fails safely on provider rate limit", async () => {
    await expect(
      new AIInterpretationGateway(new DeterministicAIProvider("rate_limit")).interpret(request()),
    ).rejects.toThrow("RATE_LIMITED");
  });
  it("validator enforces correlation and schema", () => {
    const errors = new AIOutputValidator().validate(request(), {
      requestId: "other",
      provider: "x",
      model: "x",
      task: "FACT",
      schemaVersion: "2",
      candidates: [],
      sourceReferences: [],
      warnings: [],
      validationIssues: [],
      createdAt: new Date(),
    });
    expect(errors.length).toBe(2);
  });
  it("requires source excerpts for evidence promotion", () => {
    const candidate = {
      candidateId: "c",
      candidateType: "FACT_CANDIDATE" as const,
      statement: "fact",
      sourceReference: "interview-1:1",
      rationale: "x",
      knowledgeReferences: [],
      status: "AI_DERIVED" as const,
      review: "NONE" as const,
    };
    expect(new CandidateEvidencePromotionGate().evaluate(candidate).outcome).toBe("REJECT");
  });
  it("keeps AI confidence distinct from Brain confidence", async () => {
    const result = await new AIInterpretationGateway(new DeterministicAIProvider()).interpret(
      request(),
    );
    expect(result.candidates[0]).not.toHaveProperty("confidence");
    expect(result.candidates[0]).toHaveProperty("confidenceHint");
  });
  it("preserves tenant request boundary", async () => {
    await expect(
      new AIInterpretationGateway(new DeterministicAIProvider()).interpret({
        ...request(),
        tenantId: "",
      }),
    ).rejects.toThrow();
  });
  it("does not produce a production decision", async () => {
    const result = await new AIInterpretationGateway(new DeterministicAIProvider()).interpret(
      request(),
    );
    expect(result).not.toHaveProperty("recommendation");
    expect(result).not.toHaveProperty("roi");
    expect(result).not.toHaveProperty("published");
  });
});
