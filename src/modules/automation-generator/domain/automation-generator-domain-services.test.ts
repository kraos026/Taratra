import { describe, expect, it } from "vitest";
import { DeterministicIdFactory, type ContentHasher } from "./automation-generator-domain-services";
import {
  CanonicalSourcePath,
  ContentHash,
  GraphSchemaVersion,
  NodeId,
} from "./automation-generator-value-objects";

class StableTestHasher implements ContentHasher {
  sha256(canonicalValue: string): ContentHash {
    let accumulator = 0;
    for (const character of canonicalValue)
      accumulator = (accumulator * 31 + character.charCodeAt(0)) >>> 0;
    return ContentHash.create(accumulator.toString(16).padEnd(64, "0"));
  }
}

describe("DeterministicIdFactory", () => {
  const factory = new DeterministicIdFactory(new StableTestHasher());

  it("returns the same NodeId for the same canonical input", () => {
    const input = {
      graphSchemaVersion: GraphSchemaVersion.create("1.0.0"),
      sourcePath: CanonicalSourcePath.create("/elements/invoice"),
      nodeType: "ACTION",
    };
    expect(factory.nodeId(input).value).toBe(factory.nodeId(input).value);
  });

  it("changes the deterministic NodeId when canonical input changes", () => {
    const base = {
      graphSchemaVersion: GraphSchemaVersion.create("1.0.0"),
      sourcePath: CanonicalSourcePath.create("/elements/invoice"),
      nodeType: "ACTION",
    };
    expect(factory.nodeId(base).value).not.toBe(
      factory.nodeId({ ...base, sourcePath: CanonicalSourcePath.create("/elements/customer") })
        .value,
    );
  });

  it("returns stable EdgeIds", () => {
    const input = {
      sourceNodeId: NodeId.create(`node_${"1".repeat(32)}`),
      targetNodeId: NodeId.create(`node_${"2".repeat(32)}`),
      edgeType: "SUCCESS",
      canonicalOrdinal: 0,
    };
    expect(factory.edgeId(input).value).toBe(factory.edgeId(input).value);
  });
});
