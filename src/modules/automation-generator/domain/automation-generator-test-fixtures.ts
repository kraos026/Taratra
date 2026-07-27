import {
  AutomationGeneration,
  type AutomationGenerationRequest,
  type GenerationResult,
} from "./automation-generation";
import {
  CanonicalAutomationGraph,
  CanonicalNode,
  CanonicalPort,
} from "./canonical-automation-graph";
import { CapabilityClassification, NodeType, PortDirection } from "./automation-generator-enums";
import {
  ExplanationCode,
  ExplanationParameters,
  GenerationExplanation,
  GenerationProvenance,
  ProvenanceReference,
} from "./generation-provenance";
import {
  CatalogVersion,
  ContentHash,
  ErrorPolicy,
  GenerationId,
  GenerationLineageId,
  GenerationVersion,
  GeneratorVersion,
  GraphSchemaVersion,
  NodeId,
  TenantId,
} from "./automation-generator-value-objects";

export const ids = {
  tenant: "018f22e2-7c10-7a11-8c11-012345678901",
  generation: "018f22e2-7c10-7a11-8c11-012345678902",
  lineage: "018f22e2-7c10-7a11-8c11-012345678903",
  secondGeneration: "018f22e2-7c10-7a11-8c11-012345678904",
};

export function requestInput(
  overrides: Partial<AutomationGenerationRequest> = {},
): AutomationGenerationRequest {
  const tenantId = TenantId.create(ids.tenant);
  return {
    tenantId,
    generationId: GenerationId.create(ids.generation),
    lineageId: GenerationLineageId.create(ids.lineage),
    generationVersion: GenerationVersion.create(1),
    specification: {
      id: "specification-snapshot",
      tenantId,
      lineageId: "specification-lineage",
      version: 1,
      status: "PUBLISHED",
      contentHash: ContentHash.create("a".repeat(64)),
    },
    generatorVersion: GeneratorVersion.create("1.0.0"),
    graphSchemaVersion: GraphSchemaVersion.create("1.0.0"),
    ruleCatalogVersion: CatalogVersion.create("1.0.0"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

export function graphFor(
  request: AutomationGenerationRequest = requestInput(),
): CanonicalAutomationGraph {
  const provenance = provenanceReference();
  const node = CanonicalNode.create({
    id: nodeId(),
    type: NodeType.Action,
    definition: {
      responsibility: "Process a canonical item",
      capabilityCodes: ["cap.process"],
    },
    inputs: [
      CanonicalPort.create({
        id: "input",
        direction: PortDirection.Input,
        dataType: "object",
        required: true,
      }),
    ],
    outputs: [
      CanonicalPort.create({
        id: "output",
        direction: PortDirection.Output,
        dataType: "object",
        required: true,
      }),
    ],
    errorPolicy: ErrorPolicy.fail(),
    provenance,
  });
  return CanonicalAutomationGraph.create({
    metadata: {
      generationId: request.generationId,
      lineageId: request.lineageId,
      generationVersion: request.generationVersion,
      automationSpecificationSnapshotId: request.specification.id,
      automationSpecificationVersion: request.specification.version,
      automationSpecificationContentHash: request.specification.contentHash,
      generatorVersion: request.generatorVersion,
      graphSchemaVersion: request.graphSchemaVersion,
      ruleCatalogVersion: request.ruleCatalogVersion,
      contentHash: ContentHash.create("b".repeat(64)),
    },
    nodes: [node],
    edges: [],
    inputs: [],
    outputs: [],
  });
}

export function generationResult(
  request: AutomationGenerationRequest = requestInput(),
): GenerationResult {
  const graph = graphFor(request);
  const reference = provenanceReference();
  const explanation = GenerationExplanation.create({
    generatedElementId: nodeId(),
    code: ExplanationCode.create("CAPABILITY_PROJECTED"),
    parameters: ExplanationParameters.create({ capability: "cap.process" }),
  });
  return {
    graph,
    provenance: [
      GenerationProvenance.create({
        generatedElementId: nodeId(),
        sourceSpecificationElementId: "spec-step",
        capabilityCode: "cap.process",
        classification: CapabilityClassification.Consumed,
        reference,
        explanation,
      }),
    ],
    explanations: [explanation],
    unsupportedCapabilityCodes: [],
  };
}

export function requestedGeneration(): AutomationGeneration {
  return AutomationGeneration.request(requestInput());
}

export function provenanceReference(): ProvenanceReference {
  return ProvenanceReference.create({
    sourceSpecificationElementIds: ["spec-step"],
    consumedCapabilities: ["cap.process"],
    appliedRuleIds: ["project_action"],
    ruleCatalogVersion: CatalogVersion.create("1.0.0"),
    generatorVersion: GeneratorVersion.create("1.0.0"),
  });
}

export function nodeId(): NodeId {
  return NodeId.create(`node_${"1".repeat(32)}`);
}
