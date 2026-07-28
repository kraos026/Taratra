import { DomainValueError } from "./automation-generator-errors";

abstract class ImmutableStringValue {
  protected constructor(readonly value: string) {
    Object.freeze(this);
  }

  equals(other: ImmutableStringValue): boolean {
    return this.constructor === other.constructor && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

abstract class ImmutablePositiveInteger {
  protected constructor(readonly value: number) {
    Object.freeze(this);
  }

  equals(other: ImmutablePositiveInteger): boolean {
    return this.constructor === other.constructor && this.value === other.value;
  }
}

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0)
    throw new DomainValueError(`${label} must be a non-empty string`);
  return value.trim();
}

function uuid(value: unknown, label: string): string {
  const parsed = nonEmpty(value, label).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(parsed))
    throw new DomainValueError(`${label} must be a UUID`);
  return parsed;
}

function uuidV7(value: unknown, label: string): string {
  const parsed = uuid(value, label);
  if (parsed[14] !== "7") throw new DomainValueError(`${label} must be a UUIDv7`);
  return parsed;
}

function semver(value: unknown, label: string): string {
  const parsed = nonEmpty(value, label);
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(parsed))
    throw new DomainValueError(`${label} must use semantic versioning`);
  return parsed;
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1)
    throw new DomainValueError(`${label} must be a positive integer`);
  return value;
}

export class GenerationId extends ImmutableStringValue {
  static create(value: unknown): GenerationId {
    return new GenerationId(uuid(value, "GenerationId"));
  }
}

export class GenerationLineageId extends ImmutableStringValue {
  static create(value: unknown): GenerationLineageId {
    return new GenerationLineageId(uuid(value, "GenerationLineageId"));
  }
}

export class TenantId extends ImmutableStringValue {
  static create(value: unknown): TenantId {
    return new TenantId(uuid(value, "TenantId"));
  }
}

export class GenerationVersion extends ImmutablePositiveInteger {
  static create(value: unknown): GenerationVersion {
    return new GenerationVersion(positiveInteger(value, "GenerationVersion"));
  }

  next(): GenerationVersion {
    return new GenerationVersion(this.value + 1);
  }
}

export class LockVersion extends ImmutablePositiveInteger {
  static create(value: unknown): LockVersion {
    return new LockVersion(positiveInteger(value, "LockVersion"));
  }

  next(): LockVersion {
    return new LockVersion(this.value + 1);
  }
}

export class GeneratorVersion extends ImmutableStringValue {
  static create(value: unknown): GeneratorVersion {
    return new GeneratorVersion(semver(value, "GeneratorVersion"));
  }
}

export class GraphSchemaVersion extends ImmutableStringValue {
  static create(value: unknown): GraphSchemaVersion {
    return new GraphSchemaVersion(semver(value, "GraphSchemaVersion"));
  }
}

export class CatalogVersion extends ImmutableStringValue {
  static create(value: unknown): CatalogVersion {
    return new CatalogVersion(semver(value, "CatalogVersion"));
  }
}

export class ContentHash extends ImmutableStringValue {
  static create(value: unknown): ContentHash {
    const parsed = nonEmpty(value, "ContentHash").toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(parsed))
      throw new DomainValueError("ContentHash must be a SHA-256 hexadecimal digest");
    return new ContentHash(parsed);
  }
}

export class NodeId extends ImmutableStringValue {
  static create(value: unknown): NodeId {
    const parsed = nonEmpty(value, "NodeId").toLowerCase();
    if (!/^node_[0-9a-f]{32}$/.test(parsed))
      throw new DomainValueError("NodeId must be a deterministic node identifier");
    return new NodeId(parsed);
  }
}

export class EdgeId extends ImmutableStringValue {
  static create(value: unknown): EdgeId {
    const parsed = nonEmpty(value, "EdgeId").toLowerCase();
    if (!/^edge_[0-9a-f]{32}$/.test(parsed))
      throw new DomainValueError("EdgeId must be a deterministic edge identifier");
    return new EdgeId(parsed);
  }
}

export class CanonicalSourcePath extends ImmutableStringValue {
  static create(value: unknown): CanonicalSourcePath {
    const parsed = nonEmpty(value, "CanonicalSourcePath");
    if (!/^\/[a-zA-Z0-9._~/-]+$/.test(parsed) || parsed.includes("//") || parsed.includes(".."))
      throw new DomainValueError("CanonicalSourcePath is invalid");
    return new CanonicalSourcePath(parsed);
  }
}

export class IdempotencyKey extends ImmutableStringValue {
  static create(value: unknown): IdempotencyKey {
    return new IdempotencyKey(uuidV7(value, "IdempotencyKey"));
  }
}

export class CorrelationId extends ImmutableStringValue {
  static create(value: unknown): CorrelationId {
    return new CorrelationId(uuidV7(value, "CorrelationId"));
  }
}

export class VariableReference extends ImmutableStringValue {
  static create(value: unknown): VariableReference {
    const parsed = nonEmpty(value, "VariableReference");
    if (!/^[a-z][a-zA-Z0-9_.-]*$/.test(parsed))
      throw new DomainValueError("VariableReference is invalid");
    return new VariableReference(parsed);
  }
}

export class NodeOutputReference {
  private constructor(
    readonly nodeId: NodeId,
    readonly outputPort: string,
  ) {
    Object.freeze(this);
  }

  static create(nodeId: NodeId, outputPort: unknown): NodeOutputReference {
    return new NodeOutputReference(nodeId, portName(outputPort));
  }
}

export class SecretReference extends ImmutableStringValue {
  static create(value: unknown): SecretReference {
    const parsed = nonEmpty(value, "SecretReference");
    if (!/^secret:[a-z][a-zA-Z0-9_.-]*$/.test(parsed))
      throw new DomainValueError("SecretReference must be an opaque secret reference");
    return new SecretReference(parsed);
  }
}

export class RetryPolicy {
  private constructor(
    readonly maximumAttempts: number,
    readonly backoffMilliseconds: number,
  ) {
    Object.freeze(this);
  }

  static create(maximumAttempts: unknown, backoffMilliseconds: unknown): RetryPolicy {
    const attempts = positiveInteger(maximumAttempts, "maximumAttempts");
    if (attempts > 10) throw new DomainValueError("maximumAttempts must not exceed 10");
    if (
      typeof backoffMilliseconds !== "number" ||
      !Number.isInteger(backoffMilliseconds) ||
      backoffMilliseconds < 0
    )
      throw new DomainValueError("backoffMilliseconds must be a non-negative integer");
    return new RetryPolicy(attempts, backoffMilliseconds);
  }
}

export class TimeoutPolicy {
  private constructor(readonly milliseconds: number) {
    Object.freeze(this);
  }

  static create(milliseconds: unknown): TimeoutPolicy {
    return new TimeoutPolicy(positiveInteger(milliseconds, "timeout milliseconds"));
  }
}

export type ErrorPolicyMode = "FAIL" | "ROUTE" | "CONTINUE";

export class ErrorPolicy {
  private constructor(
    readonly mode: ErrorPolicyMode,
    readonly targetNodeId: NodeId | null,
  ) {
    Object.freeze(this);
  }

  static fail(): ErrorPolicy {
    return new ErrorPolicy("FAIL", null);
  }

  static continue(): ErrorPolicy {
    return new ErrorPolicy("CONTINUE", null);
  }

  static route(targetNodeId: NodeId): ErrorPolicy {
    return new ErrorPolicy("ROUTE", targetNodeId);
  }
}

export class CompensationPolicy {
  private constructor(
    readonly compensationNodeId: NodeId,
    readonly required: boolean,
  ) {
    Object.freeze(this);
  }

  static create(compensationNodeId: NodeId, required: unknown): CompensationPolicy {
    if (typeof required !== "boolean")
      throw new DomainValueError("Compensation required flag must be boolean");
    return new CompensationPolicy(compensationNodeId, required);
  }
}

export type LiteralValue = string | number | boolean | null;

export type CanonicalExpression =
  | { readonly kind: "literal"; readonly value: LiteralValue }
  | { readonly kind: "variable"; readonly reference: string }
  | { readonly kind: "nodeOutput"; readonly nodeId: string; readonly outputPort: string }
  | { readonly kind: "configuration"; readonly key: string }
  | { readonly kind: "secret"; readonly reference: string }
  | {
      readonly kind: "boolean";
      readonly operator: "all" | "any" | "none";
      readonly operands: readonly CanonicalExpression[];
    }
  | { readonly kind: "not"; readonly operand: CanonicalExpression }
  | {
      readonly kind: "comparison";
      readonly operator:
        | "equal"
        | "notEqual"
        | "greaterThan"
        | "greaterOrEqual"
        | "lessThan"
        | "lessOrEqual"
        | "contains"
        | "in";
      readonly left: CanonicalExpression;
      readonly right: CanonicalExpression;
    }
  | {
      readonly kind: "transform";
      readonly operator: "concat" | "coalesce" | "select" | "rename" | "format";
      readonly operands: readonly CanonicalExpression[];
    }
  | { readonly kind: "list"; readonly items: readonly CanonicalExpression[] }
  | {
      readonly kind: "object";
      readonly entries: Readonly<Record<string, CanonicalExpression>>;
    };

export class Expression {
  private constructor(readonly value: CanonicalExpression) {
    deepFreeze(this.value);
    Object.freeze(this);
  }

  static create(value: unknown): Expression {
    return new Expression(parseExpression(value));
  }
}

export class DataMapping {
  private constructor(readonly entries: Readonly<Record<string, Expression>>) {
    Object.freeze(this.entries);
    Object.freeze(this);
  }

  static create(entries: Readonly<Record<string, Expression>>): DataMapping {
    const keys = Object.keys(entries);
    if (keys.length === 0) throw new DomainValueError("DataMapping must contain entries");
    for (const key of keys) {
      if (!/^[a-z][a-zA-Z0-9_.-]*$/.test(key))
        throw new DomainValueError("DataMapping target is invalid");
      if (!(entries[key] instanceof Expression))
        throw new DomainValueError("DataMapping values must be Expressions");
    }
    return new DataMapping(Object.freeze({ ...entries }));
  }
}

function portName(value: unknown): string {
  const parsed = nonEmpty(value, "Port");
  if (!/^[a-z][a-zA-Z0-9_-]*$/.test(parsed)) throw new DomainValueError("Port is invalid");
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
  );
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  const keys = Object.keys(value);
  if (keys.some((key) => !allowed.includes(key)) || allowed.some((key) => !keys.includes(key)))
    throw new DomainValueError("Expression contains missing or unknown fields");
}

function expressionArray(value: unknown): readonly CanonicalExpression[] {
  if (!Array.isArray(value) || value.length === 0)
    throw new DomainValueError("Expression operands must be a non-empty array");
  return Object.freeze(value.map(parseExpression));
}

function parseExpression(value: unknown): CanonicalExpression {
  if (!isRecord(value) || typeof value.kind !== "string")
    throw new DomainValueError("Expression must be a discriminated data object");

  switch (value.kind) {
    case "literal":
      exactKeys(value, ["kind", "value"]);
      if (
        value.value !== null &&
        typeof value.value !== "string" &&
        typeof value.value !== "number" &&
        typeof value.value !== "boolean"
      )
        throw new DomainValueError("Literal expression value is invalid");
      return { kind: "literal", value: value.value };
    case "variable":
      exactKeys(value, ["kind", "reference"]);
      return { kind: "variable", reference: VariableReference.create(value.reference).value };
    case "nodeOutput":
      exactKeys(value, ["kind", "nodeId", "outputPort"]);
      return {
        kind: "nodeOutput",
        nodeId: NodeId.create(value.nodeId).value,
        outputPort: portName(value.outputPort),
      };
    case "configuration":
      exactKeys(value, ["kind", "key"]);
      return { kind: "configuration", key: VariableReference.create(value.key).value };
    case "secret":
      exactKeys(value, ["kind", "reference"]);
      return { kind: "secret", reference: SecretReference.create(value.reference).value };
    case "boolean":
      exactKeys(value, ["kind", "operator", "operands"]);
      if (value.operator !== "all" && value.operator !== "any" && value.operator !== "none")
        throw new DomainValueError("Boolean expression operator is invalid");
      return {
        kind: "boolean",
        operator: value.operator,
        operands: expressionArray(value.operands),
      };
    case "not":
      exactKeys(value, ["kind", "operand"]);
      return { kind: "not", operand: parseExpression(value.operand) };
    case "comparison":
      exactKeys(value, ["kind", "operator", "left", "right"]);
      return {
        kind: "comparison",
        operator: comparisonOperator(value.operator),
        left: parseExpression(value.left),
        right: parseExpression(value.right),
      };
    case "transform":
      exactKeys(value, ["kind", "operator", "operands"]);
      return {
        kind: "transform",
        operator: transformOperator(value.operator),
        operands: expressionArray(value.operands),
      };
    case "list":
      exactKeys(value, ["kind", "items"]);
      return { kind: "list", items: expressionArray(value.items) };
    case "object": {
      exactKeys(value, ["kind", "entries"]);
      if (!isRecord(value.entries))
        throw new DomainValueError("Object expression entries are invalid");
      const entries: Record<string, CanonicalExpression> = {};
      for (const key of Object.keys(value.entries).sort())
        entries[key] = parseExpression(value.entries[key]);
      return { kind: "object", entries: Object.freeze(entries) };
    }
    default:
      throw new DomainValueError("Expression kind is not supported");
  }
}

function comparisonOperator(
  value: unknown,
):
  | "equal"
  | "notEqual"
  | "greaterThan"
  | "greaterOrEqual"
  | "lessThan"
  | "lessOrEqual"
  | "contains"
  | "in" {
  switch (value) {
    case "equal":
    case "notEqual":
    case "greaterThan":
    case "greaterOrEqual":
    case "lessThan":
    case "lessOrEqual":
    case "contains":
    case "in":
      return value;
    default:
      throw new DomainValueError("Comparison operator is invalid");
  }
}

function transformOperator(value: unknown): "concat" | "coalesce" | "select" | "rename" | "format" {
  switch (value) {
    case "concat":
    case "coalesce":
    case "select":
    case "rename":
    case "format":
      return value;
    default:
      throw new DomainValueError("Transform operator is invalid");
  }
}

function deepFreeze(value: unknown): void {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
}
