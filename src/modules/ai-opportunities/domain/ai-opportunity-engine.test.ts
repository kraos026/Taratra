import { describe, expect, it } from "vitest";
import { AiOpportunityEngine, type AiOpportunityInput } from "./ai-opportunity-engine";
const input = (): AiOpportunityInput => ({
  analysisId: "analysis",
  analysisStatus: "published",
  processMapId: "process",
  processMapStatus: "published",
  processName: "Invoice processing",
  processConfidence: 80,
  knowledgeSnapshotId: "knowledge",
  findings: [
    {
      id: "finding",
      identifier: "manual_invoice_processing:process",
      ruleCode: "manual_invoice_processing",
      severity: "high",
      confidence: 90,
      processId: "process",
      departmentId: "finance",
      systemId: null,
      factIds: ["fact"],
    },
  ],
  facts: [
    {
      id: "fact",
      key: "representative_documents.field_examples",
      domain: "finance",
      value: "invoice examples",
      confidence: 80,
    },
  ],
  capabilities: [
    {
      id: "ocr",
      code: "ocr",
      version: 1,
      title: "OCR",
      description: "OCR",
      requiredData: ["representative_documents"],
      expectedOutputs: ["text"],
      limitations: [],
      complexity: "medium",
    },
    {
      id: "extract",
      code: "information_extraction",
      version: 1,
      title: "Extraction",
      description: "Extraction",
      requiredData: ["field_examples"],
      expectedOutputs: ["fields"],
      limitations: [],
      complexity: "high",
    },
  ],
  detectionRules: [
    {
      id: "rule",
      code: "invoice_intelligence",
      version: 1,
      title: "Invoice intelligence",
      findingCodes: ["manual_invoice_processing"],
      processTerms: [],
      knowledgeTerms: [],
      capabilityCodes: ["ocr", "information_extraction"],
      businessProblem: "Manual invoices",
      impact: "Reduce entry",
      risk: "medium",
    },
  ],
  scoreDefinitions: [
    "business_impact",
    "implementation_complexity",
    "data_readiness",
    "confidence",
    "feasibility",
    "ai_readiness",
  ].map((code) => ({
    id: code,
    code,
    version: 1,
    formula: { type: "documented" },
  })),
});
describe("AiOpportunityEngine", () => {
  const engine = new AiOpportunityEngine();
  it("detects a multi-capability opportunity from published canonical inputs", () => {
    const result = engine.detect(input());
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0]?.capabilities.map((item) => item.code)).toEqual([
      "ocr",
      "information_extraction",
    ]);
    expect(result.opportunities[0]?.scores).toHaveLength(6);
    expect(result.validations).toEqual([
      expect.objectContaining({ code: "ai_opportunities_valid" }),
    ]);
  });
  it("uses the validated explicit formulas", () => {
    const opportunity = engine.detect(input()).opportunities[0]!;
    expect(opportunity.businessImpact).toBe(75);
    expect(opportunity.technicalComplexity).toBe(80);
    expect(opportunity.dataReadiness).toBe(100);
    expect(opportunity.confidence).toBe(85);
    expect(opportunity.feasibility).toBe(73.25);
    expect(opportunity.aiReadiness).toBe(84.42);
  });
  it("rejects unpublished source contracts", () => {
    const value = input();
    value.analysisStatus = "draft";
    value.processMapStatus = "draft";
    expect(engine.detect(value).validations.map((item) => item.code)).toEqual([
      "analysis_not_published",
      "process_not_published",
    ]);
  });
  it("does not generate an opportunity without a related finding", () => {
    const value = input();
    value.findings = [];
    expect(engine.detect(value).opportunities).toEqual([]);
  });
  it("preserves deterministic rebuild results", () => {
    expect(engine.rebuild(input())).toEqual(engine.detect(input()));
  });
});
