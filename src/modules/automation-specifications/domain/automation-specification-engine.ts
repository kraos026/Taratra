import type {
  AutomationSpecificationInput,
  AutomationSpecificationResult,
  BlueprintEdge,
  SpecificationElement,
  SpecificationProvenance,
  SpecificationRule,
  SpecificationValidation,
  TransformationDecision,
} from "./automation-specification";
import { SpecificationElementValue } from "./automation-specification-value-objects";

export class AutomationSpecificationEngine {
  generate(input: AutomationSpecificationInput): AutomationSpecificationResult {
    const rules = input.rules.filter((rule) => rule.published);
    const transformationRules = rules.filter((rule) => rule.ruleType === "transformation");
    const elements: SpecificationElement[] = [];
    const provenance: SpecificationProvenance[] = [];

    for (const rule of transformationRules) {
      for (const projected of this.project(rule, input)) {
        elements.push(
          SpecificationElementValue.create({
            ...projected.element,
            displayOrder: elements.length,
          }).value,
        );
        provenance.push(...projected.provenance);
      }
    }

    this.recordIgnoredBlueprintElements(input, provenance);
    const result: AutomationSpecificationResult = {
      name: `${input.blueprint.name} — Automation Specification`,
      objective: input.blueprint.objective,
      scope: `Specification derived from Solution Blueprint v${input.blueprint.versionNumber}`,
      elements,
      provenance,
      validations: [],
      catalogVersions: rules.map(({ id, code, version }) => ({ id, code, version })),
    };
    result.validations = this.validate(input, result);
    return result;
  }

  rebuild(input: AutomationSpecificationInput) {
    return this.generate(input);
  }

  validate(
    input: AutomationSpecificationInput,
    result: AutomationSpecificationResult,
  ): SpecificationValidation[] {
    return input.rules
      .filter((rule) => rule.published && rule.ruleType === "validation" && rule.operator)
      .map((rule) => ({
        ruleCode: rule.code,
        ruleVersion: rule.version,
        severity: rule.severity ?? "error",
        passed: this.evaluate(rule, input, result),
        targetLocalId: null,
        message: rule.description,
        details: { operator: rule.operator },
      }));
  }

  private project(rule: SpecificationRule, input: AutomationSpecificationInput) {
    const decision = rule.decision;
    if (!decision) return [];
    const projector = PROJECTORS[decision];
    return projector ? projector(input, rule) : [];
  }

  private evaluate(
    rule: SpecificationRule,
    input: AutomationSpecificationInput,
    result: AutomationSpecificationResult,
  ) {
    switch (rule.operator) {
      case "source_published":
        return input.blueprint.status === "published";
      case "elements_present":
        return result.elements.length > 0;
      case "unique_local_ids":
        return (
          new Set(result.elements.map((element) => element.localId)).size === result.elements.length
        );
      case "references_valid":
        return referencesValid(result.elements);
      case "graph_acyclic":
        return !hasCycle(result.elements);
      case "data_contracts_resolved":
        return dataContractsResolved(result.elements);
      case "provenance_complete":
        return result.elements.every((element) =>
          result.provenance.some((link) => link.targetLocalId === element.localId && link.consumed),
        );
      default:
        return false;
    }
  }

  private recordIgnoredBlueprintElements(
    input: AutomationSpecificationInput,
    provenance: SpecificationProvenance[],
  ) {
    const consumed = new Set(
      provenance.filter((item) => item.consumed).map((item) => item.sourceElementId),
    );
    const sources = [
      ...input.blueprint.components.map((item) => ["component", item.code] as const),
      ...input.blueprint.capabilities.map((item) => ["capability", item.code] as const),
      ...input.blueprint.connectors.map((item) => ["connector", item.code] as const),
      ...input.blueprint.constraints.map((item) => ["constraint", item.code] as const),
    ];
    for (const [type, id] of sources)
      if (!consumed.has(id))
        provenance.push({
          targetLocalId: null,
          sourceElementType: type,
          sourceElementId: id,
          ruleCode: null,
          ruleVersion: null,
          reason: "No published transformation decision selected this source element",
          consumed: false,
        });
  }
}

type Projection = {
  element: Omit<SpecificationElement, "displayOrder">;
  provenance: SpecificationProvenance[];
};
type Projector = (input: AutomationSpecificationInput, rule: SpecificationRule) => Projection[];

const PROJECTORS: Record<TransformationDecision, Projector> = {
  project_triggers: (input, rule) =>
    input.blueprint.inputs.map((name, index) =>
      projection(
        `trigger_${slug(name)}_${index + 1}`,
        "trigger",
        { name, kind: "input_received" },
        "input",
        name,
        rule,
      ),
    ),
  project_data_contracts: (input, rule) => [
    ...input.blueprint.inputs.map((name, index) =>
      projection(
        `input_${slug(name)}_${index + 1}`,
        "data_contract",
        { name, direction: "input", sensitivity: "inherited" },
        "input",
        name,
        rule,
      ),
    ),
    ...input.blueprint.outputs.map((name, index) =>
      projection(
        `output_${slug(name)}_${index + 1}`,
        "data_contract",
        { name, direction: "output", sensitivity: "inherited" },
        "output",
        name,
        rule,
      ),
    ),
  ],
  project_steps: (input, rule) =>
    input.blueprint.components.map((component, index) => {
      const projected = projection(
        `step_${slug(component.code)}_${index + 1}`,
        "step",
        {
          name: component.name,
          responsibility: component.name,
          requiredCapabilities: input.blueprint.capabilities.map((item) => item.code),
          inputContracts: input.blueprint.inputs.map(
            (name, itemIndex) => `input_${slug(name)}_${itemIndex + 1}`,
          ),
          outputContracts: input.blueprint.outputs.map(
            (name, itemIndex) => `output_${slug(name)}_${itemIndex + 1}`,
          ),
        },
        "component",
        component.code,
        rule,
      );
      projected.provenance.push(
        ...input.blueprint.capabilities.map((capability) =>
          provenance(
            projected.element.localId,
            "capability",
            capability.code,
            rule,
            "Required by the projected step",
          ),
        ),
      );
      return projected;
    }),
  project_dependencies: (input, rule) =>
    input.blueprint.topology.map((edge, index) =>
      projection(
        `dependency_${index + 1}`,
        "dependency",
        {
          from: stepId(input, edge.from),
          to: stepId(input, edge.to),
          dependencyType: edge.type,
          label: edge.label,
        },
        "topology_edge",
        edgeId(edge, index),
        rule,
      ),
    ),
  project_controls: (input, rule) =>
    input.blueprint.topology
      .filter((edge) => edge.type === "approves")
      .map((edge, index) =>
        projection(
          `control_${index + 1}`,
          "control",
          { kind: "human_validation", beforeStep: stepId(input, edge.to) },
          "topology_edge",
          edgeId(edge, index),
          rule,
        ),
      ),
  project_error_policies: (input, rule) =>
    input.blueprint.components.map((component, index) =>
      projection(
        `error_${slug(component.code)}_${index + 1}`,
        "error_policy",
        { category: "step_failure", expectedBehavior: "stop_and_report" },
        "component",
        component.code,
        rule,
      ),
    ),
  project_security: (input, rule) => [
    ...input.blueprint.connectors.flatMap((connector, connectorIndex) => [
      ...connector.secrets.map((secret, index) =>
        projection(
          `security_secret_${connectorIndex + 1}_${index + 1}`,
          "security",
          { kind: "secret", requirement: secret },
          "connector",
          connector.code,
          rule,
        ),
      ),
      ...connector.permissions.map((permission, index) =>
        projection(
          `security_permission_${connectorIndex + 1}_${index + 1}`,
          "security",
          { kind: "permission", requirement: permission },
          "connector",
          connector.code,
          rule,
        ),
      ),
    ]),
    ...input.blueprint.constraints.map((constraint, index) =>
      projection(
        `security_constraint_${index + 1}`,
        "security",
        { kind: "constraint", requirement: constraint.name },
        "constraint",
        constraint.code,
        rule,
      ),
    ),
  ],
  project_observability: (input, rule) =>
    input.blueprint.components.map((component, index) =>
      projection(
        `observability_${slug(component.code)}_${index + 1}`,
        "observability",
        { event: "step_completed", subject: component.name },
        "component",
        component.code,
        rule,
      ),
    ),
  project_acceptance_criteria: (input, rule) =>
    input.blueprint.outputs.map((output, index) =>
      projection(
        `acceptance_${slug(output)}_${index + 1}`,
        "acceptance_criterion",
        { condition: "output_produced", expectedResult: output },
        "output",
        output,
        rule,
      ),
    ),
};

function projection(
  localId: string,
  type: SpecificationElement["type"],
  definition: Record<string, unknown>,
  sourceElementType: string,
  sourceElementId: string,
  rule: SpecificationRule,
): Projection {
  return {
    element: { localId, type, definition },
    provenance: [
      provenance(
        localId,
        sourceElementType,
        sourceElementId,
        rule,
        `Projected by published decision ${rule.code} v${rule.version}`,
      ),
    ],
  };
}

function provenance(
  targetLocalId: string,
  sourceElementType: string,
  sourceElementId: string,
  rule: SpecificationRule,
  reason: string,
): SpecificationProvenance {
  return {
    targetLocalId,
    sourceElementType,
    sourceElementId,
    ruleCode: rule.code,
    ruleVersion: rule.version,
    reason,
    consumed: true,
  };
}

function slug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "item"
  );
}

function stepId(input: AutomationSpecificationInput, componentCode: string) {
  const index = input.blueprint.components.findIndex((item) => item.code === componentCode);
  return index < 0 ? `missing_${slug(componentCode)}` : `step_${slug(componentCode)}_${index + 1}`;
}

function edgeId(edge: BlueprintEdge, index: number) {
  return `${edge.from}:${edge.to}:${edge.type}:${index}`;
}

function referencesValid(elements: SpecificationElement[]) {
  const steps = new Set(
    elements.filter((element) => element.type === "step").map((element) => element.localId),
  );
  return elements
    .filter((element) => element.type === "dependency")
    .every(
      (element) =>
        steps.has(String(element.definition.from)) && steps.has(String(element.definition.to)),
    );
}

function hasCycle(elements: SpecificationElement[]) {
  const dependencies = elements.filter(
    (element) =>
      element.type === "dependency" &&
      EXECUTION_DEPENDENCY_TYPES.has(String(element.definition.dependencyType)),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (node: string): boolean => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const dependency of dependencies.filter((element) => element.definition.from === node))
      if (visit(String(dependency.definition.to))) return true;
    visiting.delete(node);
    visited.add(node);
    return false;
  };
  return elements
    .filter((element) => element.type === "step")
    .some((element) => visit(element.localId));
}

const EXECUTION_DEPENDENCY_TYPES = new Set([
  "produces",
  "consumes",
  "calls",
  "stores",
  "approves",
  "schedules",
  "authenticates",
]);

function dataContractsResolved(elements: SpecificationElement[]) {
  const contracts = new Set(
    elements
      .filter((element) => element.type === "data_contract")
      .map((element) => element.localId),
  );
  return elements
    .filter((element) => element.type === "step")
    .every((element) =>
      [
        ...asStrings(element.definition.inputContracts),
        ...asStrings(element.definition.outputContracts),
      ].every((contract) => contracts.has(contract)),
    );
}

function asStrings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
