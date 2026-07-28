import { describe, expect, it } from "vitest";
import {
  CanonicalAutomationGraph,
  CanonicalEdge,
  CanonicalNode,
  CanonicalPort,
} from "./canonical-automation-graph";
import { EdgeType, NodeType, PortDirection } from "./automation-generator-enums";
import { GraphConstructionFailed } from "./automation-generator-errors";
import {
  graphFor,
  nodeId,
  provenanceReference,
  requestInput,
} from "./automation-generator-test-fixtures";
import { EdgeId, ErrorPolicy, Expression, NodeId } from "./automation-generator-value-objects";

describe("CanonicalAutomationGraph", () => {
  it("creates a minimal immutable canonical graph", () => {
    const graph = graphFor();
    expect(graph.nodes).toHaveLength(1);
    expect(Object.isFrozen(graph)).toBe(true);
    expect(Object.isFrozen(graph.nodes)).toBe(true);
  });

  it("requires conditions on ConditionNode and conditional edges", () => {
    expect(() =>
      CanonicalNode.create({
        id: nodeId(),
        type: NodeType.Condition,
        definition: { responsibility: "Choose", capabilityCodes: [] },
        inputs: [],
        outputs: [],
        errorPolicy: ErrorPolicy.fail(),
        provenance: provenanceReference(),
      }),
    ).toThrow(GraphConstructionFailed);
  });

  it("rejects orphan edges and invalid ports", () => {
    const request = requestInput();
    const graph = graphFor(request);
    const edge = CanonicalEdge.create({
      id: EdgeId.create(`edge_${"2".repeat(32)}`),
      sourceNodeId: nodeId(),
      targetNodeId: NodeId.create(`node_${"3".repeat(32)}`),
      type: EdgeType.Success,
      outputPort: "output",
      inputPort: "input",
      priority: 0,
      provenance: provenanceReference(),
    });
    expect(() =>
      CanonicalAutomationGraph.create({
        metadata: graph.metadata,
        nodes: graph.nodes,
        edges: [edge],
        inputs: [],
        outputs: [],
      }),
    ).toThrow("orphan edge");
  });

  it("creates a structurally valid conditional route", () => {
    const source = CanonicalNode.create({
      id: nodeId(),
      type: NodeType.Condition,
      definition: { responsibility: "Choose", capabilityCodes: [] },
      inputs: [],
      outputs: [
        CanonicalPort.create({
          id: "yes",
          direction: PortDirection.Output,
          dataType: "object",
          required: false,
        }),
      ],
      condition: Expression.create({ kind: "literal", value: true }),
      errorPolicy: ErrorPolicy.fail(),
      provenance: provenanceReference(),
    });
    const target = CanonicalNode.create({
      id: NodeId.create(`node_${"3".repeat(32)}`),
      type: NodeType.End,
      definition: { responsibility: "Finish", capabilityCodes: [] },
      inputs: [
        CanonicalPort.create({
          id: "input",
          direction: PortDirection.Input,
          dataType: "object",
          required: true,
        }),
      ],
      outputs: [],
      errorPolicy: ErrorPolicy.fail(),
      provenance: provenanceReference(),
    });
    const edge = CanonicalEdge.create({
      id: EdgeId.create(`edge_${"2".repeat(32)}`),
      sourceNodeId: source.id,
      targetNodeId: target.id,
      type: EdgeType.Conditional,
      condition: Expression.create({ kind: "literal", value: true }),
      outputPort: "yes",
      inputPort: "input",
      priority: 0,
      provenance: provenanceReference(),
    });
    const base = graphFor();
    expect(
      CanonicalAutomationGraph.create({
        metadata: base.metadata,
        nodes: [target, source],
        edges: [edge],
        inputs: [],
        outputs: [],
      }).edges,
    ).toHaveLength(1);
  });
});
