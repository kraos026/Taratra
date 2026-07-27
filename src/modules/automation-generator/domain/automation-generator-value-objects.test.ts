import { describe, expect, it } from "vitest";
import { DomainValueError } from "./automation-generator-errors";
import {
  CanonicalSourcePath,
  CatalogVersion,
  CompensationPolicy,
  ContentHash,
  CorrelationId,
  DataMapping,
  EdgeId,
  ErrorPolicy,
  Expression,
  GenerationId,
  GenerationLineageId,
  GenerationVersion,
  GeneratorVersion,
  GraphSchemaVersion,
  IdempotencyKey,
  LockVersion,
  NodeId,
  NodeOutputReference,
  RetryPolicy,
  SecretReference,
  TenantId,
  TimeoutPolicy,
  VariableReference,
} from "./automation-generator-value-objects";

const uuid = "018f22e2-7c10-7a11-8c11-012345678901";

describe("Automation Generator Value Objects", () => {
  it("creates immutable validated identities", () => {
    const values = [
      GenerationId.create(uuid),
      GenerationLineageId.create(uuid),
      TenantId.create(uuid),
    ];
    expect(values.every(Object.isFrozen)).toBe(true);
    expect(() => GenerationId.create("not-an-id")).toThrow(DomainValueError);
  });

  it("validates semantic and positive versions", () => {
    expect(GeneratorVersion.create("1.2.3").value).toBe("1.2.3");
    expect(GraphSchemaVersion.create("2.0.0").value).toBe("2.0.0");
    expect(CatalogVersion.create("3.4.5-beta.1").value).toBe("3.4.5-beta.1");
    expect(GenerationVersion.create(1).next().value).toBe(2);
    expect(LockVersion.create(2).next().value).toBe(3);
    expect(() => GeneratorVersion.create("v1")).toThrow(DomainValueError);
    expect(() => LockVersion.create(0)).toThrow(DomainValueError);
  });

  it("validates content hashes and deterministic element ids", () => {
    expect(ContentHash.create("a".repeat(64)).value).toHaveLength(64);
    expect(NodeId.create(`node_${"1".repeat(32)}`).value).toMatch(/^node_/);
    expect(EdgeId.create(`edge_${"2".repeat(32)}`).value).toMatch(/^edge_/);
    expect(() => ContentHash.create("abc")).toThrow(DomainValueError);
    expect(() => NodeId.create("node-random")).toThrow(DomainValueError);
  });

  it("validates canonical source paths", () => {
    expect(CanonicalSourcePath.create("/elements/step_1").value).toBe("/elements/step_1");
    expect(() => CanonicalSourcePath.create("../secret")).toThrow(DomainValueError);
  });

  it("requires UUIDv7 idempotency and correlation identifiers", () => {
    expect(IdempotencyKey.create(uuid).value).toBe(uuid);
    expect(CorrelationId.create(uuid).value).toBe(uuid);
    expect(() => CorrelationId.create("018f22e2-7c10-4a11-8c11-012345678901")).toThrow(
      DomainValueError,
    );
  });

  it("validates references without exposing secret values", () => {
    const node = NodeId.create(`node_${"1".repeat(32)}`);
    expect(VariableReference.create("invoice.total").value).toBe("invoice.total");
    expect(NodeOutputReference.create(node, "result").outputPort).toBe("result");
    expect(SecretReference.create("secret:billing.api_key").value).toBe("secret:billing.api_key");
    expect(() => SecretReference.create("actual-secret-value")).toThrow(DomainValueError);
  });

  it("validates retry, timeout, error and compensation policies", () => {
    const node = NodeId.create(`node_${"1".repeat(32)}`);
    expect(RetryPolicy.create(3, 500).maximumAttempts).toBe(3);
    expect(TimeoutPolicy.create(5000).milliseconds).toBe(5000);
    expect(ErrorPolicy.route(node).targetNodeId).toBe(node);
    expect(CompensationPolicy.create(node, true).required).toBe(true);
    expect(() => RetryPolicy.create(11, 0)).toThrow(DomainValueError);
    expect(() => TimeoutPolicy.create(0)).toThrow(DomainValueError);
  });

  it("validates and deeply freezes the closed expression model", () => {
    const expression = Expression.create({
      kind: "comparison",
      operator: "greaterThan",
      left: { kind: "variable", reference: "invoice.total" },
      right: { kind: "literal", value: 100 },
    });
    expect(Object.isFrozen(expression)).toBe(true);
    expect(Object.isFrozen(expression.value)).toBe(true);
    expect(() =>
      Expression.create({ kind: "script", language: "javascript", code: "return true" }),
    ).toThrow(DomainValueError);
    expect(() => Expression.create({ kind: "literal", value: true, unknown: "field" })).toThrow(
      DomainValueError,
    );
  });

  it("creates immutable structured data mappings", () => {
    const mapping = DataMapping.create({
      total: Expression.create({ kind: "variable", reference: "invoice.total" }),
    });
    expect(Object.isFrozen(mapping)).toBe(true);
    expect(Object.isFrozen(mapping.entries)).toBe(true);
    expect(() => DataMapping.create({})).toThrow(DomainValueError);
  });
});
