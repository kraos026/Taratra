import { describe, expect, it } from "vitest";
import {
  BusinessAnalysisEngine,
  type AnalysisInput,
  type AnalysisRule,
} from "./business-analysis-engine";

const rule = (
  code: string,
  evaluationLogic: Record<string, unknown>,
  severity: AnalysisRule["severity"] = "medium",
): AnalysisRule => ({
  id: code,
  code,
  version: 1,
  title: code,
  description: code,
  severity,
  category: "operations",
  evaluationLogic,
  explanationTemplate: `${code} detected`,
  recommendationHint: "Review the process",
});

function input(rules: AnalysisRule[]): AnalysisInput {
  return {
    processMap: {
      id: "map",
      name: "Invoice payment",
      status: "published",
      completeness: 65,
      confidence: 60,
      coverage: 90,
      ownerId: null,
      systemIds: [],
      validationCodes: ["orphan_activity"],
    },
    nodes: [
      {
        id: "n1",
        key: "enter",
        type: "step",
        name: "Enter invoice document",
        description: null,
        executionMode: "manual",
        durationMinutes: 1500,
        actorId: "actor",
        departmentId: "finance",
        systemId: null,
        factIds: ["fact"],
      },
      {
        id: "n2",
        key: "enter-again",
        type: "step",
        name: "Enter invoice document",
        description: null,
        executionMode: "manual",
        durationMinutes: 1500,
        actorId: "actor",
        departmentId: "finance",
        systemId: null,
        factIds: ["fact"],
      },
      {
        id: "n3",
        key: "validate",
        type: "decision",
        name: "Validate paper invoice",
        description: null,
        executionMode: "manual",
        durationMinutes: 60,
        actorId: "actor",
        departmentId: "finance",
        systemId: null,
        factIds: ["fact"],
      },
      {
        id: "n4",
        key: "approve",
        type: "decision",
        name: "Approve by email",
        description: null,
        executionMode: "manual",
        durationMinutes: 60,
        actorId: "actor",
        departmentId: "finance",
        systemId: null,
        factIds: ["fact"],
      },
      {
        id: "n5",
        key: "validate-final",
        type: "decision",
        name: "Final validation Excel",
        description: null,
        executionMode: "manual",
        durationMinutes: 60,
        actorId: "actor",
        departmentId: "finance",
        systemId: null,
        factIds: ["fact"],
      },
    ],
    facts: [
      {
        id: "fact",
        key: "finance.software",
        domain: "finance",
        value: "Excel email paper",
        confidence: 80,
      },
    ],
    rules,
  };
}

describe("BusinessAnalysisEngine", () => {
  const engine = new BusinessAnalysisEngine();
  it("detects every approved deterministic MVP condition", () => {
    const rules = [
      rule("duplicate_manual_entry", { operator: "duplicateManualStep", minimum: 2 }),
      rule("single_point_of_failure", {
        operator: "actorManualShare",
        minimumSteps: 3,
        threshold: 50,
      }),
      rule("missing_process_owner", { operator: "missingOwner" }),
      rule("long_approval_chain", { operator: "approvalCount", minimum: 3 }),
      rule("manual_document_transfer", { operator: "manualDocumentTransfer" }),
      rule("manual_invoice_processing", { operator: "manualInvoice" }),
      rule("excel_dependency", { operator: "systemContains", terms: ["excel"] }),
      rule("email_dependency", { operator: "systemContains", terms: ["email"] }),
      rule("paper_document", { operator: "textContains", terms: ["paper"] }),
      rule("missing_business_system", { operator: "missingSystem" }),
      rule("missing_documentation", { operator: "undocumentedShare", threshold: 30 }),
      rule("disconnected_process", { operator: "validationCode", codes: ["orphan_activity"] }),
      rule("high_manual_workload", { operator: "manualHoursMonthly", threshold: 40 }),
      rule("low_confidence_process", {
        operator: "processMetricBelow",
        metric: "confidence",
        threshold: 70,
      }),
      rule("incomplete_process", {
        operator: "processMetricBelow",
        metric: "completeness",
        threshold: 80,
      }),
      rule("missing_kpi", { operator: "missingKnowledgeTerm", terms: ["kpi", "metric"] }),
      rule("repeated_validation", { operator: "validationStepCount", minimum: 3 }),
      rule("human_bottleneck", { operator: "actorManualDurationShare", threshold: 60 }),
    ];
    expect(engine.detectFindings(input(rules)).map((finding) => finding.rule.code)).toHaveLength(
      18,
    );
  });

  it("does not invent findings when a rule evaluates false", () => {
    expect(
      engine.detectFindings(
        input([
          rule("missing_approval", { operator: "missingApproval", processTerms: ["invoice"] }),
        ]),
      ),
    ).toEqual([]);
  });

  it("calculates explicit deterministic risk, scores and health", () => {
    const result = engine.analyze(
      input([rule("single_point_of_failure", { operator: "missingOwner" }, "critical")]),
    );
    expect(result.risk).toEqual({
      score: 25,
      raw: 25,
      formula: "min(100, sum(severity points))",
    });
    expect(result.scores).toHaveLength(9);
    expect(result.health).toHaveLength(8);
    expect(result.scores.every((score) => score.calculation.formula.length > 0)).toBe(true);
  });

  it("returns blocking traceability validation when evidence is absent", () => {
    const withoutFacts = input([rule("missing_process_owner", { operator: "missingOwner" })]);
    withoutFacts.facts = [];
    expect(engine.analyze(withoutFacts).validations).toContainEqual(
      expect.objectContaining({ code: "missing_evidence", severity: "error" }),
    );
  });

  it("returns stable ordering by severity then rule code", () => {
    const result = engine.detectFindings(
      input([
        rule("z_low", { operator: "missingOwner" }, "low"),
        rule("b_high", { operator: "missingOwner" }, "high"),
        rule("a_high", { operator: "missingOwner" }, "high"),
      ]),
    );
    expect(result.map((finding) => finding.rule.code)).toEqual(["a_high", "b_high", "z_low"]);
  });
});
