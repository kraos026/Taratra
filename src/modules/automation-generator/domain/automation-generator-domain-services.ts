import type { CanonicalAutomationGraph } from "./canonical-automation-graph";
import type { GenerationExplanation, GenerationProvenance } from "./generation-provenance";
import type { GenerationRuleCatalog } from "./generation-rule-catalog";
import {
  CanonicalSourcePath,
  ContentHash,
  EdgeId,
  GraphSchemaVersion,
  NodeId,
} from "./automation-generator-value-objects";

export interface PublishedAutomationSpecificationSnapshot {
  readonly id: string;
  readonly tenantId: string;
  readonly lineageId: string;
  readonly version: number;
  readonly status: "PUBLISHED";
  readonly contentHash: ContentHash;
  readonly elements: readonly {
    readonly id: string;
    readonly type: string;
    readonly capabilityCodes: readonly string[];
    readonly definition: Readonly<Record<string, unknown>>;
  }[];
}

export interface GenerationCompilationInput {
  readonly specification: PublishedAutomationSpecificationSnapshot;
  readonly catalog: GenerationRuleCatalog;
  readonly graphSchemaVersion: GraphSchemaVersion;
}

export interface GenerationCompilationResult {
  readonly graph: CanonicalAutomationGraph;
  readonly provenance: readonly GenerationProvenance[];
  readonly explanations: readonly GenerationExplanation[];
  readonly unsupportedCapabilityCodes: readonly string[];
}

export interface GenerationCompiler {
  compile(input: GenerationCompilationInput): GenerationCompilationResult;
}

export interface ContentHasher {
  sha256(canonicalValue: string): ContentHash;
}

export class DeterministicIdFactory {
  constructor(private readonly contentHasher: ContentHasher) {}

  nodeId(input: {
    graphSchemaVersion: GraphSchemaVersion;
    sourcePath: CanonicalSourcePath;
    nodeType: string;
  }): NodeId {
    const digest = this.contentHasher.sha256(
      canonicalTuple([
        "node",
        input.graphSchemaVersion.value,
        input.sourcePath.value,
        input.nodeType,
      ]),
    );
    return NodeId.create(`node_${digest.value.slice(0, 32)}`);
  }

  edgeId(input: {
    sourceNodeId: NodeId;
    targetNodeId: NodeId;
    edgeType: string;
    canonicalOrdinal: number;
  }): EdgeId {
    if (!Number.isInteger(input.canonicalOrdinal) || input.canonicalOrdinal < 0)
      throw new Error("Canonical edge ordinal must be a non-negative integer");
    const digest = this.contentHasher.sha256(
      canonicalTuple([
        "edge",
        input.sourceNodeId.value,
        input.targetNodeId.value,
        input.edgeType,
        String(input.canonicalOrdinal),
      ]),
    );
    return EdgeId.create(`edge_${digest.value.slice(0, 32)}`);
  }
}

function canonicalTuple(values: readonly string[]): string {
  return JSON.stringify(values);
}
