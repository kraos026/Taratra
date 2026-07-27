import type {
  SpecificationRule,
  SpecificationSeverity,
  SpecificationElement,
  SpecificationElementType,
  SpecificationStatus,
  SpecificationValidationOperator,
  TransformationDecision,
} from "./automation-specification";

export class SpecificationValueError extends Error {}

export class PositiveVersion {
  private constructor(readonly value: number) {}

  static create(value: number) {
    if (!Number.isInteger(value) || value < 1)
      throw new SpecificationValueError("Version must be a positive integer");
    return new PositiveVersion(value);
  }
}

export class LocalElementId {
  private constructor(readonly value: string) {}

  static create(value: string) {
    if (!/^[a-z][a-z0-9_-]*$/.test(value))
      throw new SpecificationValueError("Local element id is invalid");
    return new LocalElementId(value);
  }
}

export class SerializedDefinition {
  private constructor(readonly value: Readonly<Record<string, unknown>>) {}

  static create(value: Record<string, unknown>) {
    if (Object.getPrototypeOf(value) !== Object.prototype)
      throw new SpecificationValueError("Definition must be a plain data object");
    assertSerializable(value);
    return new SerializedDefinition(Object.freeze(structuredClone(value)));
  }
}

export class SpecificationElementValue {
  private constructor(readonly value: Readonly<SpecificationElement>) {}

  static create(input: {
    localId: string;
    type: SpecificationElementType;
    definition: Record<string, unknown>;
    displayOrder: number;
  }) {
    if (!Number.isInteger(input.displayOrder) || input.displayOrder < 0)
      throw new SpecificationValueError("Display order is invalid");
    return new SpecificationElementValue(
      Object.freeze({
        localId: LocalElementId.create(input.localId).value,
        type: input.type,
        definition: SerializedDefinition.create(input.definition).value,
        displayOrder: input.displayOrder,
      }),
    );
  }
}

export class BlueprintReference {
  private constructor(
    readonly id: string,
    readonly organizationId: string,
    readonly versionNumber: number,
  ) {}

  static create(id: string, organizationId: string, versionNumber: number) {
    if (!id || !organizationId) throw new SpecificationValueError("Blueprint reference is invalid");
    return new BlueprintReference(id, organizationId, PositiveVersion.create(versionNumber).value);
  }
}

export class SpecificationRuleCatalogEntry {
  private constructor(readonly value: Readonly<SpecificationRule>) {}

  static create(input: {
    id: string;
    code: string;
    version: number;
    ruleType: unknown;
    result: unknown;
    severity: unknown;
    description: string;
    status: unknown;
  }) {
    if (!input.id || !input.code || !input.description)
      throw new SpecificationValueError("Catalog rule identity is invalid");
    if (input.status !== "published")
      throw new SpecificationValueError("Catalog rule must be published");
    if (!isPlainRecord(input.result))
      throw new SpecificationValueError("Catalog rule result must be a plain object");

    const base = {
      id: input.id,
      code: input.code,
      version: PositiveVersion.create(input.version).value,
      description: input.description,
      published: true,
    };

    if (input.ruleType === "transformation") {
      assertOnlyKey(input.result, "decision");
      return new SpecificationRuleCatalogEntry(
        Object.freeze({
          ...base,
          ruleType: "transformation",
          decision: transformationDecision(input.result.decision),
        }),
      );
    }

    if (input.ruleType === "validation") {
      assertOnlyKey(input.result, "operator");
      return new SpecificationRuleCatalogEntry(
        Object.freeze({
          ...base,
          ruleType: "validation",
          operator: validationOperator(input.result.operator),
          severity: specificationSeverity(input.severity),
        }),
      );
    }

    throw new SpecificationValueError("Catalog rule type is invalid");
  }
}

export const SPECIFICATION_STATUSES: readonly SpecificationStatus[] = [
  "draft",
  "validated",
  "published",
  "archived",
];

function assertSerializable(value: unknown): void {
  if (
    value === undefined ||
    typeof value === "function" ||
    typeof value === "symbol" ||
    typeof value === "bigint"
  )
    throw new SpecificationValueError("Definition contains executable or non-serializable data");
  if (Array.isArray(value)) {
    value.forEach(assertSerializable);
    return;
  }
  if (value !== null && typeof value === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype)
      throw new SpecificationValueError("Definition contains a non-data object");
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN_DEFINITION_KEYS.test(key))
        throw new SpecificationValueError(
          "Definition contains executable, platform, or decision behavior",
        );
      assertSerializable(item);
    }
  }
}

const FORBIDDEN_DEFINITION_KEYS =
  /^(algorithm|code|script|workflow|platform|provider|execution|decision|rule)$/i;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
  );
}

function assertOnlyKey(value: Record<string, unknown>, expected: string) {
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== expected)
    throw new SpecificationValueError("Catalog rule result contains unknown data");
}

function transformationDecision(value: unknown): TransformationDecision {
  switch (value) {
    case "project_triggers":
    case "project_data_contracts":
    case "project_steps":
    case "project_dependencies":
    case "project_controls":
    case "project_error_policies":
    case "project_security":
    case "project_observability":
    case "project_acceptance_criteria":
      return value;
    default:
      throw new SpecificationValueError("Catalog transformation decision is invalid");
  }
}

function validationOperator(value: unknown): SpecificationValidationOperator {
  switch (value) {
    case "source_published":
    case "elements_present":
    case "unique_local_ids":
    case "references_valid":
    case "graph_acyclic":
    case "data_contracts_resolved":
    case "provenance_complete":
      return value;
    default:
      throw new SpecificationValueError("Catalog validation operator is invalid");
  }
}

function specificationSeverity(value: unknown): SpecificationSeverity {
  switch (value) {
    case "error":
    case "warning":
    case "information":
      return value;
    default:
      throw new SpecificationValueError("Catalog validation severity is invalid");
  }
}
