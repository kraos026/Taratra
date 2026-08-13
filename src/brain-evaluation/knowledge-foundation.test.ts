import { describe, expect, it } from "vitest";
import { Evidence } from "./brain-contracts";
import {
  KnowledgeMatcher,
  KnowledgeProvenance,
  KnowledgeScope,
  KnowledgeVersion,
  KnowledgeReliability,
  Pattern,
  InMemoryKnowledgeLibrary,
  KnowledgeContextBuilder,
  candidateFromKnowledge,
  Benchmark,
} from "./knowledge-foundation";

const provenance = KnowledgeProvenance.create({
  category: "SYNTHETIC_TEST",
  sourceId: "fixture",
  sourceLabel: "Curated fixture",
  capturedAt: new Date("2026-01-01"),
});
const common = {
  domain: "generic",
  scope: KnowledgeScope.create({ dimension: "GLOBAL" }),
  provenance,
  reliability: KnowledgeReliability.create(0.9),
  version: KnowledgeVersion.create(1),
  validFrom: new Date("2025-01-01"),
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};
const pattern = Pattern.create({
  ...common,
  id: "manual-reentry",
  type: "PROCESS_PATTERN",
  title: "Manual re-entry",
  description: "Two systems require copying",
  signals: ["copy", "two systems"],
  counterSignals: ["automated"],
  applicableSolutions: ["integration"],
});

describe("B3.1 knowledge foundation", () => {
  it("requires provenance and preserves synthetic label", () =>
    expect(pattern.item.provenance.synthetic).toBe(true));
  it("matches deterministically and remains a candidate", () => {
    const matcher = new KnowledgeMatcher();
    const facts = { facts: ["operator copy order between two systems"] };
    const a = matcher.match(pattern, facts);
    const b = matcher.match(pattern, facts);
    expect(a).toEqual(b);
    expect(a.status).toBe("MATCH");
    expect(candidateFromKnowledge(a).status).toBe("CANDIDATE");
  });
  it("does not strongly match an isolated action", () =>
    expect(new KnowledgeMatcher().match(pattern, { facts: ["copy once"] }).status).not.toBe(
      "MATCH",
    ));
  it("rejects counter-signals", () =>
    expect(
      new KnowledgeMatcher().match(pattern, { facts: ["copy between two systems is automated"] })
        .status,
    ).toBe("REJECTED"));
  it("keeps benchmark distinct from observed evidence", () => {
    const benchmark = Benchmark.create({
      ...common,
      id: "benchmark-time",
      type: "BENCHMARK",
      title: "Cycle time",
      description: "Reference",
      metric: "duration",
      value: 10,
      unit: "minutes",
      population: "sample",
      period: "2025",
      sampleSize: 5,
    });
    const observed = Evidence.create({
      evidenceId: "observed",
      sourceType: "METRIC",
      sourceReference: "company",
      sourceModule: "brain_evaluation",
      capturedAt: new Date("2026-01-01"),
      freshness: "CURRENT",
      reliability: 1,
      content: "duration 25",
      structuredValue: 25,
      provenance: {},
    });
    expect(benchmark.value).toBe(10);
    expect(observed.structuredValue).toBe(25);
  });
  it("prevents duplicate knowledge versions and bounds context", () => {
    const library = new InMemoryKnowledgeLibrary();
    library.add(pattern);
    expect(() => library.add(pattern)).toThrow();
    const context = new KnowledgeContextBuilder().build(library, common.scope, {
      patterns: 1,
      benchmarks: 1,
      solutions: 1,
    });
    expect(context.relevantPatterns).toHaveLength(1);
  });
  it("excludes deprecated knowledge", () => {
    const library = new InMemoryKnowledgeLibrary();
    library.add(
      Pattern.create({
        ...common,
        id: "old",
        type: "PROCESS_PATTERN",
        title: "Old",
        description: "old",
        lifecycle: "DEPRECATED",
        signals: ["x"],
      }),
    );
    expect(library.findPatterns()).toHaveLength(0);
  });
  it("rejects wrong scope", () => {
    const scoped = Pattern.create({
      ...common,
      id: "sector-pattern",
      scope: KnowledgeScope.create({ dimension: "SECTOR", value: "retail" }),
      type: "PROCESS_PATTERN",
      title: "Retail",
      description: "Retail",
      signals: ["sale"],
    });
    expect(
      new KnowledgeMatcher().match(scoped, {
        facts: ["sale"],
        scope: KnowledgeScope.create({ dimension: "SECTOR", value: "accounting" }),
      }).status,
    ).toBe("REJECTED");
  });
});
