import { describe, expect, it } from "vitest";
import type { AutomationSpecificationInput, SpecificationRule } from "./automation-specification";
import { AutomationSpecificationEngine } from "./automation-specification-engine";
import {
  SerializedDefinition,
  SpecificationValueError,
} from "./automation-specification-value-objects";

const transformations = [
  "project_triggers",
  "project_data_contracts",
  "project_steps",
  "project_dependencies",
  "project_controls",
  "project_error_policies",
  "project_security",
  "project_observability",
  "project_acceptance_criteria",
] as const;
const validations = [
  "source_published",
  "elements_present",
  "unique_local_ids",
  "references_valid",
  "graph_acyclic",
  "data_contracts_resolved",
  "provenance_complete",
] as const;

function input(): AutomationSpecificationInput {
  const rules: SpecificationRule[] = [
    ...transformations.map((decision, index) => ({
      id: `transformation-${index}`,
      code: decision,
      version: 1,
      ruleType: "transformation" as const,
      decision,
      description: decision,
      published: true,
    })),
    ...validations.map((operator, index) => ({
      id: `validation-${index}`,
      code: operator,
      version: 1,
      ruleType: "validation" as const,
      operator,
      severity: "error" as const,
      description: operator,
      published: true,
    })),
  ];
  return {
    blueprint: {
      id: "blueprint",
      organizationId: "organization",
      versionNumber: 2,
      status: "published",
      name: "Invoice automation",
      objective: "Process invoices",
      components: [
        { code: "receiver", name: "Receive invoice" },
        { code: "processor", name: "Process invoice" },
      ],
      capabilities: [{ code: "ocr", name: "OCR" }],
      connectors: [
        {
          code: "inbox",
          name: "Inbox",
          inputs: ["Invoice"],
          outputs: ["Message"],
          secrets: ["Mailbox credential"],
          permissions: ["email.read"],
        },
      ],
      constraints: [{ code: "audit", name: "Audit trail" }],
      inputs: ["Invoice"],
      outputs: ["Processed invoice"],
      topology: [{ from: "receiver", to: "processor", type: "calls", label: "Process" }],
    },
    rules,
  };
}

describe("AutomationSpecificationEngine", () => {
  it("deterministically projects a published Blueprint", () => {
    const engine = new AutomationSpecificationEngine();
    expect(engine.generate(input())).toEqual(engine.generate(input()));
  });

  it("projects every required abstract element without a platform or executable workflow", () => {
    const result = new AutomationSpecificationEngine().generate(input());
    expect(new Set(result.elements.map((item) => item.type))).toEqual(
      new Set([
        "trigger",
        "data_contract",
        "step",
        "dependency",
        "error_policy",
        "security",
        "observability",
        "acceptance_criterion",
      ]),
    );
    expect(JSON.stringify(result)).not.toMatch(/platform|executable|generatedCode/);
  });

  it("preserves provenance for every generated element", () => {
    const result = new AutomationSpecificationEngine().generate(input());
    expect(
      result.elements.every((element) =>
        result.provenance.some((link) => link.targetLocalId === element.localId && link.consumed),
      ),
    ).toBe(true);
    expect(result.validations.find((item) => item.ruleCode === "provenance_complete")?.passed).toBe(
      true,
    );
  });

  it("rejects a cyclic Blueprint through catalog-selected validation", () => {
    const cyclic = input();
    cyclic.blueprint.topology.push({
      from: "processor",
      to: "receiver",
      type: "calls",
      label: "Reverse",
    });
    const result = new AutomationSpecificationEngine().generate(cyclic);
    expect(result.validations.find((item) => item.ruleCode === "graph_acyclic")?.passed).toBe(
      false,
    );
  });

  it("rejects an unpublished source through validation", () => {
    const unpublished = input();
    unpublished.blueprint.status = "validated";
    const result = new AutomationSpecificationEngine().generate(unpublished);
    expect(result.validations.find((item) => item.ruleCode === "source_published")?.passed).toBe(
      false,
    );
  });

  it("ignores unpublished catalog rules", () => {
    const source = input();
    source.rules = source.rules.map((rule) =>
      rule.code === "project_observability" ? { ...rule, published: false } : rule,
    );
    expect(
      new AutomationSpecificationEngine()
        .generate(source)
        .elements.some((element) => element.type === "observability"),
    ).toBe(false);
  });

  it("stores definition_json candidates as plain immutable serialized data", () => {
    const definition = SerializedDefinition.create({ name: "data", nested: ["value"] });
    expect(Object.isFrozen(definition.value)).toBe(true);
    expect(() => SerializedDefinition.create({ execute: () => "forbidden" })).toThrow(
      SpecificationValueError,
    );
    expect(() => SerializedDefinition.create({ platform: "vendor" })).toThrow(
      SpecificationValueError,
    );
  });
});
