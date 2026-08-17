import { describe, expect, it } from "vitest";
import {
  AIInterpretationGateway,
  CandidateEvidencePromotionGate,
  type AICandidate,
  type AIInterpretationRequest,
  type AIInterpretationResult,
  type AIProvider,
  type AISemanticCandidate,
} from "./ai-interpretation-gateway";

const baseRequest = (
  overrides: Partial<AIInterpretationRequest> = {},
): AIInterpretationRequest => ({
  requestId: "semantic-req-1",
  tenantId: "tenant-a",
  companyId: "company-a",
  sourceId: "interview-1",
  sourceType: "INTERVIEW",
  sourceText:
    "When the BT arrives, ADV checks it and sends it to Marc before ERP entry. Validation is unclear.",
  task: "SEMANTIC_ENTERPRISE_UNDERSTANDING",
  schemaVersion: "semantic-enterprise-v1",
  knownClaims: ["BT may mean work order", "ADV may mean sales administration"],
  knownUnknowns: ["Validation may mean approval, data validation or quality inspection"],
  constraints: ["Return candidates only"],
  ...overrides,
});

describe("AI-1 Semantic Enterprise Understanding", () => {
  it("interprets aliases as terminology candidates without canonical merge", async () => {
    const result = await interpret([
      semanticCandidate({
        candidateId: "term-salesforce",
        statement: "Salesforce CRM, Salesforce and CRM may refer to the same system.",
        rawTerm: "Salesforce CRM",
        normalizedCandidate: "Salesforce",
        candidateType: "TERMINOLOGY",
        possibleAliases: ["Salesforce", "CRM"],
        possibleRelatedConcepts: ["customer relationship system"],
        ambiguity: "LOW",
      }),
    ]);
    expect(result.candidates[0]?.candidateType).toBe("TERMINOLOGY_MAPPING");
    expect(result.candidates[0]?.semantic?.authoritativeMerge).toBe(false);
    expect(result.candidates[0]?.semantic?.factPromotion).toBe(false);
  });

  it("preserves acronym ambiguity instead of choosing an external meaning", async () => {
    const result = await interpret([
      semanticCandidate({
        candidateId: "term-bt",
        statement: "BT may mean work order in this company context.",
        rawTerm: "BT",
        normalizedCandidate: "Work Order",
        candidateType: "TERMINOLOGY",
        possibleAliases: ["job ticket", "work order", "service sheet"],
        possibleRelatedConcepts: ["order document"],
        ambiguity: "AMBIGUOUS",
        ambiguityReasons: ["Acronym meaning is company-specific and not fully established."],
      }),
    ]);
    expect(result.candidates[0]?.semantic?.ambiguity).toBe("AMBIGUOUS");
    expect(result.candidates[0]?.semantic?.ambiguityReasons.join(" ")).toContain(
      "company-specific",
    );
  });

  it("identifies business entities through existing ENTITY candidate semantics", async () => {
    const result = await interpret([
      semanticCandidate({
        candidateId: "entity-order",
        candidateType: "BUSINESS_ENTITY",
        candidateOutputType: "ENTITY_CANDIDATE",
        statement: "BT appears to refer to an order-related document.",
        rawTerm: "BT",
        normalizedCandidate: "Work Order",
        entityKind: "ORDER",
        possibleRelatedConcepts: ["ticket", "document"],
      }),
    ]);
    expect(result.candidates[0]?.candidateType).toBe("ENTITY_CANDIDATE");
    expect(result.candidates[0]?.semantic?.entityKind).toBe("ORDER");
  });

  it("identifies process concepts as candidates only", async () => {
    const result = await interpret([
      semanticCandidate({
        candidateId: "concept-approval",
        candidateType: "PROCESS_CONCEPT",
        candidateOutputType: "PROCESS_OBSERVATION_CANDIDATE",
        statement: "Marc approval is a possible approval handoff.",
        rawTerm: "sends it to Marc",
        normalizedCandidate: "Approval handoff",
        processConceptKind: "HANDOFF",
        possibleRelatedConcepts: ["approval", "wait state"],
      }),
    ]);
    expect(result.candidates[0]?.semantic?.processConceptKind).toBe("HANDOFF");
    expect(new CandidateEvidencePromotionGate().evaluate(result.candidates[0]!).outcome).toBe(
      "NEED_VALIDATION",
    );
  });

  it("requires relationship candidates to preserve source evidence", async () => {
    const result = await interpret([
      semanticCandidate({
        candidateId: "relationship-approval-blocks",
        candidateType: "RELATIONSHIP",
        candidateOutputType: "RELATIONSHIP_CANDIDATE",
        statement: "Approval handoff may block ERP entry.",
        rawTerm: "sends it to Marc before ERP entry",
        normalizedCandidate: "Approval blocks ERP entry",
        relationships: [
          {
            relationshipType: "APPROVAL_BLOCKS_PROCESS",
            from: "Approval handoff",
            to: "ERP entry",
            evidenceReferences: ["interview-1:line1"],
          },
        ],
      }),
    ]);
    expect(result.candidates[0]?.semantic?.relationships[0]).toMatchObject({
      relationshipType: "APPROVAL_BLOCKS_PROCESS",
      from: "Approval handoff",
      to: "ERP entry",
    });
  });

  it("keeps named person distinct from role inference", async () => {
    const result = await interpret([
      semanticCandidate({
        candidateId: "entity-marc",
        candidateType: "BUSINESS_ENTITY",
        candidateOutputType: "ENTITY_CANDIDATE",
        statement: "Marc is a named person and may be an approver.",
        rawTerm: "Marc",
        normalizedCandidate: "Marc",
        entityKind: "NAMED_PERSON",
        possibleRelatedConcepts: ["possible approver role"],
        ambiguity: "MEDIUM",
        ambiguityReasons: ["One sentence does not establish Marc as permanent business role."],
      }),
    ]);
    expect(result.candidates[0]?.semantic?.entityKind).toBe("NAMED_PERSON");
    expect(result.candidates[0]?.semantic?.possibleRelatedConcepts).toContain(
      "possible approver role",
    );
  });

  it("interprets structured columns without changing raw field authority", async () => {
    const result = await interpret(
      [
        semanticCandidate({
          candidateId: "field-app-ts",
          candidateType: "STRUCTURED_FIELD",
          candidateOutputType: "CLASSIFICATION_CANDIDATE",
          statement: "app_ts may represent an approval timestamp.",
          rawTerm: "app_ts",
          normalizedCandidate: "APPROVAL_TIMESTAMP",
          possibleAliases: ["approval timestamp"],
          ambiguity: "LOW",
          sourceId: "csv-1",
          sourceExcerpt: "columns: cust_id, app_ts, amount",
        }),
      ],
      baseRequest({
        sourceId: "csv-1",
        sourceType: "CSV_EXPORT",
        sourceText: "columns: cust_id, app_ts, amount",
      }),
    );
    expect(result.candidates[0]?.semantic?.rawTerm).toBe("app_ts");
    expect(result.candidates[0]?.semantic?.normalizedCandidate).toBe("APPROVAL_TIMESTAMP");
    expect(result.candidates[0]?.sourceExcerpt).toContain("columns");
  });

  it("proposes cross-source semantic relation while leaving support validation to Brain", async () => {
    const result = await interpret([
      semanticCandidate({
        candidateId: "term-exception-approval",
        statement: "Exception approval and manager check may be related terms.",
        rawTerm: "manager check",
        normalizedCandidate: "Exception approval",
        candidateType: "TERMINOLOGY",
        possibleAliases: ["manager check"],
        possibleRelatedConcepts: ["exception approval"],
        relationships: [
          {
            relationshipType: "POSSIBLE_ALIAS",
            from: "manager check",
            to: "exception approval",
            evidenceReferences: ["interview-1:line1"],
          },
        ],
      }),
    ]);
    expect(result.candidates[0]?.semantic?.relationships[0]?.relationshipType).toBe(
      "POSSIBLE_ALIAS",
    );
    expect(result.candidates[0]?.status).toBe("AI_DERIVED");
  });

  it("keeps contradictory terminology as a possible contradiction candidate", async () => {
    const result = await interpret([
      semanticCandidate({
        candidateId: "contradiction-approval-owner",
        candidateType: "RELATIONSHIP",
        candidateOutputType: "RELATIONSHIP_CANDIDATE",
        statement:
          "ADV approves orders conflicts with SOP statement that Operations Manager approves exceptions.",
        rawTerm: "ADV approves",
        normalizedCandidate: "Possible approval ownership contradiction",
        ambiguity: "HIGH",
        relationships: [
          {
            relationshipType: "POSSIBLE_CONTRADICTION",
            from: "ADV approves orders",
            to: "Operations Manager approves exceptions",
            evidenceReferences: ["interview-1:line1"],
          },
        ],
      }),
    ]);
    expect(result.candidates[0]?.candidateType).toBe("RELATIONSHIP_CANDIDATE");
    expect(result.candidates[0]?.semantic?.ambiguity).toBe("HIGH");
  });

  it("rejects unsupported relationship creation", async () => {
    await expect(
      interpret([
        semanticCandidate({
          candidateId: "bad-relationship",
          candidateType: "RELATIONSHIP",
          candidateOutputType: "RELATIONSHIP_CANDIDATE",
          statement: "Unsupported relation",
          rawTerm: "x",
          normalizedCandidate: "x",
          relationships: [
            {
              relationshipType: "SYSTEM_FEEDS_SYSTEM",
              from: "CRM",
              to: "ERP",
              evidenceReferences: [],
            },
          ],
        }),
      ]),
    ).rejects.toThrow("relationship evidence is required");
  });

  it("rejects cross-company semantic leakage", async () => {
    await expect(
      interpret([
        semanticCandidate({
          candidateId: "cross-company",
          candidateType: "TERMINOLOGY",
          statement: "Leaked term",
          rawTerm: "RAR",
          normalizedCandidate: "Other company meaning",
          companyId: "company-b",
        }),
      ]),
    ).rejects.toThrow("cross-company");
  });

  it("keeps semantic candidates out of automatic FACT promotion", async () => {
    const result = await interpret([
      semanticCandidate({
        candidateId: "no-fact-promotion",
        candidateType: "TERMINOLOGY",
        statement: "RAR may mean return authorization request.",
        rawTerm: "RAR",
        normalizedCandidate: "Return authorization request",
      }),
    ]);
    const decision = new CandidateEvidencePromotionGate().evaluate(result.candidates[0]!);
    expect(decision.outcome).toBe("NEED_VALIDATION");
    expect(result.candidates[0]?.semantic?.factPromotion).toBe(false);
    expect(result.candidates[0]?.semantic?.authoritativeMerge).toBe(false);
  });
});

async function interpret(
  candidates: readonly AICandidate[],
  request: AIInterpretationRequest = baseRequest(),
): Promise<AIInterpretationResult> {
  return new AIInterpretationGateway(provider(candidates)).interpret(request);
}

function provider(candidates: readonly AICandidate[]): AIProvider {
  return {
    providerId: "semantic-fixture-provider",
    async interpret(request) {
      return {
        requestId: request.requestId,
        provider: "semantic-fixture-provider",
        model: "fixture-model",
        task: request.task,
        schemaVersion: request.schemaVersion,
        candidates,
        sourceReferences: [request.sourceId],
        warnings: [],
        validationIssues: [],
        createdAt: new Date("2026-01-01T00:00:00Z"),
      };
    },
  };
}

function semanticCandidate(input: {
  readonly candidateId: string;
  readonly statement: string;
  readonly rawTerm: string;
  readonly normalizedCandidate: string;
  readonly candidateType: AISemanticCandidate["candidateType"];
  readonly candidateOutputType?: AICandidate["candidateType"];
  readonly entityKind?: AISemanticCandidate["entityKind"];
  readonly processConceptKind?: AISemanticCandidate["processConceptKind"];
  readonly possibleAliases?: readonly string[];
  readonly possibleRelatedConcepts?: readonly string[];
  readonly ambiguity?: AISemanticCandidate["ambiguity"];
  readonly ambiguityReasons?: readonly string[];
  readonly relationships?: AISemanticCandidate["relationships"];
  readonly companyId?: string;
  readonly sourceId?: string;
  readonly sourceExcerpt?: string;
}): AICandidate {
  const request = baseRequest();
  const sourceId = input.sourceId ?? request.sourceId;
  return {
    candidateId: input.candidateId,
    candidateType: input.candidateOutputType ?? "TERMINOLOGY_MAPPING",
    statement: input.statement,
    semantic: {
      rawTerm: input.rawTerm,
      normalizedCandidate: input.normalizedCandidate,
      candidateType: input.candidateType,
      entityKind: input.entityKind,
      processConceptKind: input.processConceptKind,
      sourceContext: {
        tenantId: request.tenantId,
        companyId: input.companyId ?? request.companyId!,
        sourceId,
        sourceVersion: "1",
        locator: "line1",
      },
      possibleAliases: input.possibleAliases ?? [],
      possibleRelatedConcepts: input.possibleRelatedConcepts ?? [],
      relationships: input.relationships ?? [],
      ambiguity: input.ambiguity ?? "NONE",
      ambiguityReasons: input.ambiguityReasons ?? [],
      evidenceReferences: [`${sourceId}:line1`],
      providerMetadata: {
        provider: "semantic-fixture-provider",
        model: "fixture-model",
      },
      authoritativeMerge: false,
      factPromotion: false,
    },
    sourceReference: `${sourceId}:line1`,
    sourceExcerpt: input.sourceExcerpt ?? request.sourceText,
    rationale: "semantic fixture",
    knowledgeReferences: [],
    status: "AI_DERIVED",
    review: "REQUIRED",
  };
}
