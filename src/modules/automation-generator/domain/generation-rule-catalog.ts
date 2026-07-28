import { GenerationRuleStatus, GenerationRuleType, NodeType } from "./automation-generator-enums";
import { InvalidCatalogConfiguration } from "./automation-generator-errors";
import { CatalogVersion, GraphSchemaVersion } from "./automation-generator-value-objects";

export class GenerationRule {
  private constructor(
    readonly id: string,
    readonly code: string,
    readonly version: number,
    readonly status: GenerationRuleStatus,
    readonly type: GenerationRuleType,
    readonly priority: number,
    readonly active: boolean,
    readonly capabilityCodes: readonly string[],
    readonly targetNodeType: NodeType | null,
    readonly compatibleGraphSchemas: readonly GraphSchemaVersion[],
    readonly parameters: Readonly<Record<string, string | number | boolean>>,
  ) {
    Object.freeze(this.capabilityCodes);
    Object.freeze(this.compatibleGraphSchemas);
    Object.freeze(this.parameters);
    Object.freeze(this);
  }

  static create(input: {
    id: string;
    code: string;
    version: number;
    status: GenerationRuleStatus;
    type: GenerationRuleType;
    priority: number;
    active: boolean;
    capabilityCodes: readonly string[];
    targetNodeType?: NodeType;
    compatibleGraphSchemas: readonly GraphSchemaVersion[];
    parameters: Readonly<Record<string, string | number | boolean>>;
  }): GenerationRule {
    if (!/^[a-z][a-z0-9_]{2,63}$/.test(input.code))
      throw new InvalidCatalogConfiguration("Generation rule code is invalid");
    if (!input.id.trim()) throw new InvalidCatalogConfiguration("Generation rule id is required");
    if (!Number.isInteger(input.version) || input.version < 1)
      throw new InvalidCatalogConfiguration("Generation rule version is invalid");
    if (!Number.isInteger(input.priority) || input.priority < 0)
      throw new InvalidCatalogConfiguration("Generation rule priority is invalid");
    if (input.compatibleGraphSchemas.length === 0)
      throw new InvalidCatalogConfiguration("Generation rule requires compatible graph schemas");
    const capabilities = canonicalCodes(input.capabilityCodes);
    if (input.type === GenerationRuleType.Projection && !input.targetNodeType)
      throw new InvalidCatalogConfiguration("Projection rule requires a target node type");
    return new GenerationRule(
      input.id,
      input.code,
      input.version,
      input.status,
      input.type,
      input.priority,
      input.active,
      capabilities,
      input.targetNodeType ?? null,
      Object.freeze([...input.compatibleGraphSchemas]),
      Object.freeze({ ...input.parameters }),
    );
  }

  supports(schemaVersion: GraphSchemaVersion): boolean {
    return this.compatibleGraphSchemas.some((version) => version.equals(schemaVersion));
  }
}

export class GenerationRuleCatalog {
  private constructor(
    readonly version: CatalogVersion,
    readonly status: GenerationRuleStatus,
    readonly rules: readonly GenerationRule[],
  ) {
    Object.freeze(this.rules);
    Object.freeze(this);
  }

  static create(input: {
    version: CatalogVersion;
    status: GenerationRuleStatus;
    rules: readonly GenerationRule[];
  }): GenerationRuleCatalog {
    if (input.rules.length === 0)
      throw new InvalidCatalogConfiguration("Generation Rule Catalog cannot be empty");
    const identities = input.rules.map((rule) => `${rule.code}:${rule.version}`);
    if (new Set(identities).size !== identities.length)
      throw new InvalidCatalogConfiguration("Generation Rule Catalog contains duplicate rules");
    return new GenerationRuleCatalog(
      input.version,
      input.status,
      Object.freeze(
        [...input.rules].sort(
          (left, right) =>
            left.priority - right.priority ||
            left.code.localeCompare(right.code) ||
            left.version - right.version,
        ),
      ),
    );
  }

  publishedRulesFor(schemaVersion: GraphSchemaVersion): readonly GenerationRule[] {
    if (this.status !== GenerationRuleStatus.Published)
      throw new InvalidCatalogConfiguration("Only a published Generation Rule Catalog is usable");
    return this.rules.filter(
      (rule) =>
        rule.status === GenerationRuleStatus.Published &&
        rule.active &&
        rule.supports(schemaVersion),
    );
  }
}

function canonicalCodes(values: readonly string[]): readonly string[] {
  const codes = values.map((value) => {
    if (!/^[a-z][a-z0-9_.-]{1,127}$/.test(value))
      throw new InvalidCatalogConfiguration("Capability code is invalid");
    return value;
  });
  return Object.freeze([...new Set(codes)].sort());
}
