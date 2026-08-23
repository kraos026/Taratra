import { describe, expect, it } from "vitest";
import { BusinessAnalysisEngine } from "@/modules/business-analysis/domain/business-analysis-engine";
import { ProcessMappingEngine, type ProcessPatternInput } from "./process-mapping-engine";

const pattern: ProcessPatternInput = {
  id: "pattern",
  code: "invoice",
  version: 1,
  name: "Invoice",
  industryScope: [],
  requiredFacts: [{ match: "invoice", weight: 5 }],
  optionalFacts: [{ match: "software", weight: 2 }],
  validationRules: [
    { code: "start", severity: "error" },
    { code: "end", severity: "error" },
    { code: "owner", severity: "error" },
    { code: "cycle", severity: "warning" },
  ],
  graphTemplate: {
    nodes: [
      { key: "start", type: "input", name: "Receive" },
      { key: "work", type: "step", name: "Validate" },
      { key: "end", type: "output", name: "Paid" },
    ],
    edges: [
      ["start", "work", "triggers"],
      ["work", "end", "produces"],
    ],
  },
};
const facts = [
  {
    id: "invoice",
    key: "interview.finance.invoice",
    domain: "finance",
    value: true,
    confidence: 100,
  },
  { id: "other", key: "company.industry", domain: "company", value: "Retail", confidence: 100 },
];
const nodes = [
  {
    id: "department",
    key: "department:finance",
    type: "department",
    domain: "finance",
    label: "Finance",
    confidence: 100,
  },
  {
    id: "actor",
    key: "role:accountant",
    type: "role",
    domain: "finance",
    label: "Accountant",
    confidence: 100,
  },
  {
    id: "system",
    key: "software:odoo",
    type: "software",
    domain: "software",
    label: "Odoo",
    confidence: 100,
  },
];

describe("ProcessMappingEngine", () => {
  const engine = new ProcessMappingEngine();
  it("selects patterns deterministically", () =>
    expect(engine.findProcesses([pattern], facts, nodes)).toEqual([pattern]));
  it("builds a directed executable graph with provenance", () => {
    const build = engine.build([pattern], facts, nodes)[0]!;
    expect(build.edges).toHaveLength(2);
    expect(build.consumedFacts[0]?.fact.id).toBe("invoice");
    expect(build.ignoredFacts[0]?.reason).toBe("Not relevant to selected pattern");
  });
  it("uses only relevant facts as coverage denominator", () =>
    expect(engine.build([pattern], facts, nodes)[0]?.coverage).toBe(100));
  it("returns zero coverage when no relevant fact exists", () =>
    expect(engine.rebuild(pattern, [], nodes).coverage).toBe(0));
  it("weights confidence by pattern importance", () => {
    const build = engine.rebuild(pattern, [{ ...facts[0]!, confidence: 50 }], nodes);
    expect(build.confidence).toBe(50);
  });
  it("classifies cycles as warnings", () => {
    const cyclic: ProcessPatternInput = {
      ...pattern,
      graphTemplate: {
        ...pattern.graphTemplate,
        edges: [...pattern.graphTemplate.edges, ["end", "start", "depends_on"]],
      },
    };
    expect(engine.rebuild(cyclic, facts, nodes).validations).toContainEqual(
      expect.objectContaining({ code: "cycle", severity: "warning" }),
    );
  });

  it("projects invoice execution metadata from source facts with provenance", () => {
    const build = engine.rebuild(
      invoiceProcessingPattern,
      invoiceExecutionFacts,
      invoiceKnowledgeNodes,
    );
    const enriched = build.nodes.filter((node) => node.executionMode === "manual");

    expect(enriched.map((node) => node.key)).toEqual(["receive", "validate", "account", "approve"]);
    expect(enriched.every((node) => node.estimatedDurationMinutes === 675)).toBe(true);
    expect(enriched.every((node) => node.actorKnowledgeNodeId === "finance-manager")).toBe(true);
    expect(enriched.every((node) => node.frequency === "weekly")).toBe(true);
    expect(enriched[0]?.knowledgeFactIds).toEqual([
      "invoice-mode",
      "manual-hours",
      "invoice-time",
      "frequency",
      "invoice-owner",
    ]);
    expect(enriched[0]?.attributes?.executionMetadataProjection).toMatchObject({
      status: "AUTO_PROJECTED",
      durationSemantic: "allocated_monthly_manual_workload_minutes",
      requiresHumanValidation: false,
    });
    expect(build.nodes.find((node) => node.key === "pay")?.executionMode).toBeNull();
  });

  it("does not guess actors when owner evidence is ambiguous", () => {
    const ambiguous = engine.rebuild(
      invoiceProcessingPattern,
      invoiceExecutionFacts.map((fact) =>
        fact.id === "invoice-owner"
          ? {
              ...fact,
              value: "The Finance Manager and Accounting Assistant both own this process.",
            }
          : fact,
      ),
      [
        ...invoiceKnowledgeNodes,
        {
          id: "accounting-assistant",
          key: "role:accounting-assistant",
          type: "role",
          domain: "organization",
          label: "Accounting Assistant",
          confidence: 100,
        },
      ],
    );
    const receive = ambiguous.nodes.find((node) => node.key === "receive")!;

    expect(receive.actorKnowledgeNodeId).toBeNull();
    expect(receive.attributes?.executionMetadataProjection).toMatchObject({
      status: "AMBIGUOUS",
      requiresHumanValidation: true,
    });
  });

  it("leaves fields unknown when source execution facts are absent", () => {
    const build = engine.rebuild(
      invoiceProcessingPattern,
      invoiceExecutionFacts.filter((fact) => fact.id !== "invoice-mode"),
      invoiceKnowledgeNodes,
    );

    expect(build.nodes.every((node) => node.executionMode === null)).toBe(true);
    expect(build.nodes.every((node) => node.estimatedDurationMinutes === null)).toBe(true);
    expect(build.nodes.every((node) => node.knowledgeFactIds?.length === 0)).toBe(true);
  });

  it("feeds enriched invoice metadata into Business Analysis high and critical rules", () => {
    const build = engine.rebuild(
      invoiceProcessingPattern,
      invoiceExecutionFacts,
      invoiceKnowledgeNodes,
    );
    const result = new BusinessAnalysisEngine().detectFindings({
      processMap: {
        id: "map",
        name: build.pattern.name,
        status: "published",
        completeness: build.completeness,
        confidence: build.confidence,
        coverage: build.coverage,
        ownerId: build.ownership.ownerNodeId,
        systemIds: build.ownership.systemNodeIds,
        validationCodes: build.validations.map((validation) => validation.code),
      },
      nodes: build.nodes.map((node) => ({
        id: node.key,
        key: node.key,
        type: node.type,
        name: node.name,
        description: node.description ?? null,
        executionMode: node.executionMode ?? null,
        durationMinutes: node.estimatedDurationMinutes ?? null,
        actorId: node.actorKnowledgeNodeId ?? null,
        departmentId: node.departmentKnowledgeNodeId ?? null,
        systemId: node.systemKnowledgeNodeId ?? null,
        factIds: node.knowledgeFactIds ?? [],
      })),
      facts: invoiceExecutionFacts,
      rules: [
        analysisRule("manual_invoice_processing", { operator: "manualInvoice" }, "high"),
        analysisRule(
          "high_manual_workload",
          { operator: "manualHoursMonthly", threshold: 40 },
          "high",
        ),
        analysisRule(
          "single_point_of_failure",
          { operator: "actorManualShare", minimumSteps: 3, threshold: 50 },
          "critical",
        ),
        analysisRule(
          "human_bottleneck",
          { operator: "actorManualDurationShare", threshold: 60 },
          "critical",
        ),
      ],
    });

    expect(result.map((finding) => finding.rule.code)).toEqual([
      "human_bottleneck",
      "single_point_of_failure",
      "high_manual_workload",
      "manual_invoice_processing",
    ]);
  });
});

const invoiceProcessingPattern: ProcessPatternInput = {
  id: "invoice-processing",
  code: "invoice_processing",
  version: 1,
  name: "Traitement des factures",
  industryScope: [],
  requiredFacts: [{ match: "invoice", weight: 5 }],
  optionalFacts: [{ match: "manual", weight: 1 }],
  validationRules: [],
  graphTemplate: {
    nodes: [
      { key: "receive", type: "step", name: "Recevoir la facture" },
      { key: "validate", type: "decision", name: "Valider" },
      { key: "account", type: "step", name: "Comptabiliser" },
      { key: "approve", type: "decision", name: "Approuver" },
      { key: "pay", type: "step", name: "Payer" },
      { key: "archive", type: "step", name: "Archiver" },
    ],
    edges: [
      ["receive", "validate", "triggers"],
      ["validate", "account", "triggers"],
      ["account", "approve", "triggers"],
      ["approve", "pay", "triggers"],
      ["pay", "archive", "triggers"],
    ],
  },
};

const invoiceExecutionFacts = [
  {
    id: "invoice-mode",
    key: "interview.finance.invoice_mode",
    domain: "finance",
    value: "manual",
    confidence: 100,
  },
  {
    id: "manual-hours",
    key: "process:invoice.manual_hours_month",
    domain: "operations",
    value: 45,
    confidence: 100,
  },
  {
    id: "invoice-time",
    key: "interview.finance.invoice_time",
    domain: "finance",
    value: 45,
    confidence: 100,
  },
  {
    id: "frequency",
    key: "process:invoice.frequency",
    domain: "operations",
    value: "weekly",
    confidence: 100,
  },
  {
    id: "invoice-owner",
    key: "interview.finance.invoice_owner",
    domain: "finance",
    value: "The Finance Manager owns supplier invoice processing.",
    confidence: 100,
  },
];

const invoiceKnowledgeNodes = [
  {
    id: "finance",
    key: "department:finance",
    type: "department",
    domain: "organization",
    label: "Finance",
    confidence: 100,
  },
  {
    id: "finance-manager",
    key: "role:finance-manager",
    type: "role",
    domain: "organization",
    label: "Finance Manager",
    confidence: 100,
  },
  {
    id: "accounting-erp",
    key: "software:accounting-erp",
    type: "software",
    domain: "software",
    label: "Accounting ERP",
    confidence: 100,
  },
];

function analysisRule(
  code: string,
  evaluationLogic: Record<string, unknown>,
  severity: "critical" | "high" | "medium",
) {
  return {
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
  };
}
