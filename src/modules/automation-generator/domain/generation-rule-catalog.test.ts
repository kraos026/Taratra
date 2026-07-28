import { describe, expect, it } from "vitest";
import { GenerationRuleStatus, GenerationRuleType, NodeType } from "./automation-generator-enums";
import { InvalidCatalogConfiguration } from "./automation-generator-errors";
import { GenerationRule, GenerationRuleCatalog } from "./generation-rule-catalog";
import { CatalogVersion, GraphSchemaVersion } from "./automation-generator-value-objects";

function rule(priority = 1): GenerationRule {
  return GenerationRule.create({
    id: `rule-${priority}`,
    code: `project_action_${priority}`,
    version: 1,
    status: GenerationRuleStatus.Published,
    type: GenerationRuleType.Projection,
    priority,
    active: true,
    capabilityCodes: ["cap.action"],
    targetNodeType: NodeType.Action,
    compatibleGraphSchemas: [GraphSchemaVersion.create("1.0.0")],
    parameters: { mode: "canonical" },
  });
}

describe("GenerationRuleCatalog domain model", () => {
  it("selects only published compatible rules in deterministic priority order", () => {
    const catalog = GenerationRuleCatalog.create({
      version: CatalogVersion.create("1.0.0"),
      status: GenerationRuleStatus.Published,
      rules: [rule(2), rule(1)],
    });
    expect(
      catalog.publishedRulesFor(GraphSchemaVersion.create("1.0.0")).map((item) => item.priority),
    ).toEqual([1, 2]);
  });

  it("rejects an unpublished catalog", () => {
    const catalog = GenerationRuleCatalog.create({
      version: CatalogVersion.create("1.0.0"),
      status: GenerationRuleStatus.Draft,
      rules: [rule()],
    });
    expect(() => catalog.publishedRulesFor(GraphSchemaVersion.create("1.0.0"))).toThrow(
      InvalidCatalogConfiguration,
    );
  });

  it("rejects duplicate rule versions", () => {
    expect(() =>
      GenerationRuleCatalog.create({
        version: CatalogVersion.create("1.0.0"),
        status: GenerationRuleStatus.Published,
        rules: [rule(), rule()],
      }),
    ).toThrow("duplicate");
  });

  it("requires a projection target without embedding an algorithm", () => {
    expect(() =>
      GenerationRule.create({
        id: "rule",
        code: "project_action",
        version: 1,
        status: GenerationRuleStatus.Published,
        type: GenerationRuleType.Projection,
        priority: 1,
        active: true,
        capabilityCodes: ["cap.action"],
        compatibleGraphSchemas: [GraphSchemaVersion.create("1.0.0")],
        parameters: {},
      }),
    ).toThrow("target node type");
  });
});
