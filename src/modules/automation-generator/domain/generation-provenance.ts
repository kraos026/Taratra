import { CapabilityClassification } from "./automation-generator-enums";
import { GenerationInvariantViolation } from "./automation-generator-errors";
import {
  CatalogVersion,
  GeneratorVersion,
  NodeId,
  EdgeId,
} from "./automation-generator-value-objects";

export type GeneratedElementId = NodeId | EdgeId;

export class ExplanationCode {
  private constructor(readonly value: string) {
    Object.freeze(this);
  }

  static create(value: unknown): ExplanationCode {
    if (typeof value !== "string" || !/^[A-Z][A-Z0-9_]{2,63}$/.test(value))
      throw new GenerationInvariantViolation("Explanation code is invalid");
    return new ExplanationCode(value);
  }
}

export type ExplanationParameterValue = string | number | boolean | null;

export class ExplanationParameters {
  private constructor(readonly value: Readonly<Record<string, ExplanationParameterValue>>) {
    Object.freeze(this.value);
    Object.freeze(this);
  }

  static create(value: unknown): ExplanationParameters {
    if (!isRecord(value))
      throw new GenerationInvariantViolation("Explanation parameters must be a plain object");
    const parameters: Record<string, ExplanationParameterValue> = {};
    for (const key of Object.keys(value).sort()) {
      const parameter = value[key];
      if (
        parameter !== null &&
        typeof parameter !== "string" &&
        typeof parameter !== "number" &&
        typeof parameter !== "boolean"
      )
        throw new GenerationInvariantViolation("Explanation parameter is invalid");
      parameters[key] = parameter;
    }
    return new ExplanationParameters(parameters);
  }
}

export class ProvenanceReference {
  private constructor(
    readonly sourceSpecificationElementIds: readonly string[],
    readonly consumedCapabilities: readonly string[],
    readonly appliedRuleIds: readonly string[],
    readonly ruleCatalogVersion: CatalogVersion,
    readonly generatorVersion: GeneratorVersion,
  ) {
    Object.freeze(this.sourceSpecificationElementIds);
    Object.freeze(this.consumedCapabilities);
    Object.freeze(this.appliedRuleIds);
    Object.freeze(this);
  }

  static create(input: {
    sourceSpecificationElementIds: readonly string[];
    consumedCapabilities: readonly string[];
    appliedRuleIds: readonly string[];
    ruleCatalogVersion: CatalogVersion;
    generatorVersion: GeneratorVersion;
  }): ProvenanceReference {
    const sources = canonicalIdentifiers(input.sourceSpecificationElementIds, "source element");
    const capabilities = canonicalIdentifiers(input.consumedCapabilities, "capability");
    const rules = canonicalIdentifiers(input.appliedRuleIds, "rule");
    if (sources.length === 0 && capabilities.length === 0)
      throw new GenerationInvariantViolation("Provenance must reference consumed source data");
    return new ProvenanceReference(
      sources,
      capabilities,
      rules,
      input.ruleCatalogVersion,
      input.generatorVersion,
    );
  }
}

export class GenerationExplanation {
  private constructor(
    readonly generatedElementId: GeneratedElementId,
    readonly code: ExplanationCode,
    readonly parameters: ExplanationParameters,
  ) {
    Object.freeze(this);
  }

  static create(input: {
    generatedElementId: GeneratedElementId;
    code: ExplanationCode;
    parameters: ExplanationParameters;
  }): GenerationExplanation {
    return new GenerationExplanation(input.generatedElementId, input.code, input.parameters);
  }
}

export class GenerationProvenance {
  private constructor(
    readonly generatedElementId: GeneratedElementId | null,
    readonly sourceSpecificationElementId: string,
    readonly capabilityCode: string | null,
    readonly classification: CapabilityClassification,
    readonly reference: ProvenanceReference,
    readonly explanation: GenerationExplanation | null,
    readonly reasonCode: ExplanationCode | null,
  ) {
    Object.freeze(this);
  }

  static create(input: {
    generatedElementId: GeneratedElementId | null;
    sourceSpecificationElementId: string;
    capabilityCode?: string;
    classification: CapabilityClassification;
    reference: ProvenanceReference;
    explanation?: GenerationExplanation;
    reasonCode?: ExplanationCode;
  }): GenerationProvenance {
    const sourceId = identifier(input.sourceSpecificationElementId, "source element");
    const capability = input.capabilityCode ? identifier(input.capabilityCode, "capability") : null;
    const generatedRequired =
      input.classification === CapabilityClassification.Consumed ||
      input.classification === CapabilityClassification.Transformed ||
      input.classification === CapabilityClassification.Defaulted;
    if (generatedRequired && !input.generatedElementId)
      throw new GenerationInvariantViolation(
        `${input.classification} provenance requires a generated element`,
      );
    if (
      (input.classification === CapabilityClassification.Ignored ||
        input.classification === CapabilityClassification.Unsupported) &&
      !input.reasonCode
    )
      throw new GenerationInvariantViolation(
        `${input.classification} provenance requires a reason code`,
      );
    if (
      input.classification === CapabilityClassification.Ignored &&
      input.generatedElementId !== null
    )
      throw new GenerationInvariantViolation(
        "Ignored provenance cannot target a generated element",
      );
    return new GenerationProvenance(
      input.generatedElementId,
      sourceId,
      capability,
      input.classification,
      input.reference,
      input.explanation ?? null,
      input.reasonCode ?? null,
    );
  }
}

function canonicalIdentifiers(values: readonly string[], label: string): readonly string[] {
  return Object.freeze([...new Set(values.map((value) => identifier(value, label)))].sort());
}

function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(value))
    throw new GenerationInvariantViolation(`${label} identifier is invalid`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
  );
}
