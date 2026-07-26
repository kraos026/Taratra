import { describe, expect, it } from "vitest";
import { AutomationOpportunityEngine, type AutomationInput } from "./automation-opportunity-engine";
const input = (): AutomationInput => ({
  aiSnapshotId: "ai",
  aiSnapshotStatus: "published",
  analysisId: "analysis",
  analysisStatus: "published",
  processMapId: "process",
  processMapStatus: "published",
  knowledgeSnapshotId: "knowledge",
  findings: [
    {
      id: "finding",
      code: "manual_invoice_processing",
      severity: "high",
      confidence: 90,
      processId: "process",
      departmentId: "finance",
      systemId: "erp",
      factIds: ["fact"],
    },
  ],
  facts: [
    {
      id: "fact",
      key: "software",
      domain: "finance",
      value: "Odoo ERP invoice documents",
      confidence: 80,
    },
  ],
  aiOpportunities: [{ id: "ai-opportunity", capabilityCodes: ["ocr"], confidence: 70 }],
  patterns: [
    {
      id: "pattern",
      code: "invoice_processing",
      version: 1,
      title: "Invoice Processing",
      description: "Pattern",
      outputs: ["validated invoice"],
      complexity: "medium",
    },
  ],
  connectors: [{ id: "connector", code: "erp", version: 1, title: "ERP", aliases: ["odoo"] }],
  rules: [
    {
      id: "rule",
      code: "automate_invoices",
      version: 1,
      title: "Automate invoices",
      findingCodes: ["manual_invoice_processing"],
      aiCapabilityCodes: ["ocr"],
      patternCode: "invoice_processing",
      connectorCodes: ["erp"],
      triggerType: "File Uploaded",
      actions: ["Read", "Extract", "Validate", "Create", "Archive"],
      businessProblem: "Manual invoices",
      impact: "Automate governed invoices",
    },
  ],
  scoreDefinitions: [
    "automation_coverage",
    "business_impact",
    "technical_feasibility",
    "connector_availability",
    "automation_readiness",
    "complexity",
    "confidence",
  ].map((code) => ({ id: code, code, version: 1, formula: { type: "documented" } })),
});
describe("AutomationOpportunityEngine", () => {
  const engine = new AutomationOpportunityEngine();
  it("detects a deterministic, fully traced opportunity", () => {
    const result = engine.detect(input());
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0]).toMatchObject({
      connectorAvailability: 100,
      automationCoverage: 100,
      businessImpact: 75,
      complexity: 60,
      confidence: 82.5,
    });
    expect(result.opportunities[0]?.scores).toHaveLength(7);
    expect(result.validations[0]?.code).toBe("automation_opportunities_valid");
  });
  it("never assumes an unevidenced connector", () => {
    const value = input();
    value.facts[0]!.value = "invoice document";
    expect(engine.detect(value).opportunities[0]?.connectorAvailability).toBe(0);
  });
  it("requires all published canonical sources", () => {
    const value = input();
    value.aiSnapshotStatus = "draft";
    value.analysisStatus = "draft";
    value.processMapStatus = "draft";
    expect(engine.detect(value).validations.map((item) => item.code)).toEqual([
      "ai_opportunity_not_published",
      "analysis_not_published",
      "process_map_not_published",
    ]);
  });
  it("rejects unknown triggers and incomplete scores", () => {
    const value = input();
    value.rules[0]!.triggerType = "Magic";
    value.scoreDefinitions = [];
    expect(engine.detect(value).validations.map((item) => item.code)).toEqual([
      "unknown_trigger",
      "unknown_score_definition",
    ]);
  });
  it("returns stable rebuild results", () =>
    expect(engine.rebuild(input())).toEqual(engine.detect(input())));
});
