import { describe, expect, it } from "vitest";
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
});
