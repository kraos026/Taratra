import type {
  SpecificationElement,
  SpecificationElementType,
  SpecificationStatus,
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
