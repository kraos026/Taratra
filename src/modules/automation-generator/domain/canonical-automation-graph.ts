import { EdgeType, NodeType, PortDirection, VariableScope } from "./automation-generator-enums";
import { GraphConstructionFailed } from "./automation-generator-errors";
import type { ProvenanceReference } from "./generation-provenance";
import {
  CatalogVersion,
  CompensationPolicy,
  ContentHash,
  DataMapping,
  EdgeId,
  ErrorPolicy,
  Expression,
  GenerationId,
  GenerationLineageId,
  GenerationVersion,
  GeneratorVersion,
  GraphSchemaVersion,
  NodeId,
  RetryPolicy,
  SecretReference,
  TimeoutPolicy,
} from "./automation-generator-value-objects";

export class CanonicalPort {
  private constructor(
    readonly id: string,
    readonly direction: PortDirection,
    readonly dataType: string,
    readonly required: boolean,
  ) {
    Object.freeze(this);
  }

  static create(input: {
    id: string;
    direction: PortDirection;
    dataType: string;
    required: boolean;
  }): CanonicalPort {
    if (!/^[a-z][a-zA-Z0-9_-]*$/.test(input.id))
      throw new GraphConstructionFailed("Canonical port id is invalid");
    if (!/^[a-z][a-zA-Z0-9_.-]*$/.test(input.dataType))
      throw new GraphConstructionFailed("Canonical port data type is invalid");
    if (typeof input.required !== "boolean")
      throw new GraphConstructionFailed("Canonical port required flag is invalid");
    return new CanonicalPort(input.id, input.direction, input.dataType, input.required);
  }
}

export class CanonicalVariable {
  private constructor(
    readonly id: string,
    readonly scope: VariableScope,
    readonly dataType: string,
    readonly initialValue: Expression | null,
    readonly secretReference: SecretReference | null,
  ) {
    Object.freeze(this);
  }

  static create(input: {
    id: string;
    scope: VariableScope;
    dataType: string;
    initialValue?: Expression;
    secretReference?: SecretReference;
  }): CanonicalVariable {
    if (!/^[a-z][a-zA-Z0-9_.-]*$/.test(input.id))
      throw new GraphConstructionFailed("Canonical variable id is invalid");
    if (!/^[a-z][a-zA-Z0-9_.-]*$/.test(input.dataType))
      throw new GraphConstructionFailed("Canonical variable data type is invalid");
    if (input.initialValue && input.secretReference)
      throw new GraphConstructionFailed("Secret variables cannot contain a literal initial value");
    return new CanonicalVariable(
      input.id,
      input.scope,
      input.dataType,
      input.initialValue ?? null,
      input.secretReference ?? null,
    );
  }
}

export interface CanonicalNodeDefinition {
  readonly responsibility: string;
  readonly capabilityCodes: readonly string[];
}

export class CanonicalNode {
  private constructor(
    readonly id: NodeId,
    readonly type: NodeType,
    readonly definition: Readonly<CanonicalNodeDefinition>,
    readonly inputs: readonly CanonicalPort[],
    readonly outputs: readonly CanonicalPort[],
    readonly condition: Expression | null,
    readonly dataMapping: DataMapping | null,
    readonly retryPolicy: RetryPolicy | null,
    readonly timeoutPolicy: TimeoutPolicy | null,
    readonly errorPolicy: ErrorPolicy,
    readonly compensationPolicy: CompensationPolicy | null,
    readonly provenance: ProvenanceReference,
  ) {
    Object.freeze(this.definition.capabilityCodes);
    Object.freeze(this.definition);
    Object.freeze(this.inputs);
    Object.freeze(this.outputs);
    Object.freeze(this);
  }

  static create(input: {
    id: NodeId;
    type: NodeType;
    definition: CanonicalNodeDefinition;
    inputs: readonly CanonicalPort[];
    outputs: readonly CanonicalPort[];
    condition?: Expression;
    dataMapping?: DataMapping;
    retryPolicy?: RetryPolicy;
    timeoutPolicy?: TimeoutPolicy;
    errorPolicy: ErrorPolicy;
    compensationPolicy?: CompensationPolicy;
    provenance: ProvenanceReference;
  }): CanonicalNode {
    if (!input.definition.responsibility.trim())
      throw new GraphConstructionFailed("Canonical node responsibility is required");
    const inputs = uniquePorts(input.inputs, PortDirection.Input);
    const outputs = uniquePorts(input.outputs, PortDirection.Output);
    if (input.type === NodeType.Condition && !input.condition)
      throw new GraphConstructionFailed("Condition node requires an expression");
    return new CanonicalNode(
      input.id,
      input.type,
      Object.freeze({
        responsibility: input.definition.responsibility.trim(),
        capabilityCodes: Object.freeze([...new Set(input.definition.capabilityCodes)].sort()),
      }),
      inputs,
      outputs,
      input.condition ?? null,
      input.dataMapping ?? null,
      input.retryPolicy ?? null,
      input.timeoutPolicy ?? null,
      input.errorPolicy,
      input.compensationPolicy ?? null,
      input.provenance,
    );
  }

  hasPort(portId: string, direction: PortDirection): boolean {
    const ports = direction === PortDirection.Input ? this.inputs : this.outputs;
    return ports.some((port) => port.id === portId);
  }
}

export class CanonicalEdge {
  private constructor(
    readonly id: EdgeId,
    readonly sourceNodeId: NodeId,
    readonly targetNodeId: NodeId,
    readonly type: EdgeType,
    readonly condition: Expression | null,
    readonly outputPort: string,
    readonly inputPort: string,
    readonly priority: number,
    readonly provenance: ProvenanceReference,
  ) {
    Object.freeze(this);
  }

  static create(input: {
    id: EdgeId;
    sourceNodeId: NodeId;
    targetNodeId: NodeId;
    type: EdgeType;
    condition?: Expression;
    outputPort: string;
    inputPort: string;
    priority: number;
    provenance: ProvenanceReference;
  }): CanonicalEdge {
    if (!/^[a-z][a-zA-Z0-9_-]*$/.test(input.outputPort))
      throw new GraphConstructionFailed("Edge output port is invalid");
    if (!/^[a-z][a-zA-Z0-9_-]*$/.test(input.inputPort))
      throw new GraphConstructionFailed("Edge input port is invalid");
    if (!Number.isInteger(input.priority) || input.priority < 0)
      throw new GraphConstructionFailed("Edge priority must be a non-negative integer");
    if (input.type === EdgeType.Conditional && !input.condition)
      throw new GraphConstructionFailed("Conditional edge requires an expression");
    return new CanonicalEdge(
      input.id,
      input.sourceNodeId,
      input.targetNodeId,
      input.type,
      input.condition ?? null,
      input.outputPort,
      input.inputPort,
      input.priority,
      input.provenance,
    );
  }
}

export interface CanonicalGraphMetadata {
  readonly generationId: GenerationId;
  readonly lineageId: GenerationLineageId;
  readonly generationVersion: GenerationVersion;
  readonly automationSpecificationSnapshotId: string;
  readonly automationSpecificationVersion: number;
  readonly automationSpecificationContentHash: ContentHash;
  readonly generatorVersion: GeneratorVersion;
  readonly graphSchemaVersion: GraphSchemaVersion;
  readonly ruleCatalogVersion: CatalogVersion;
  readonly contentHash: ContentHash;
}

export class CanonicalAutomationGraph {
  private constructor(
    readonly metadata: Readonly<CanonicalGraphMetadata>,
    readonly nodes: readonly CanonicalNode[],
    readonly edges: readonly CanonicalEdge[],
    readonly variables: readonly CanonicalVariable[],
    readonly inputs: readonly CanonicalPort[],
    readonly outputs: readonly CanonicalPort[],
  ) {
    Object.freeze(this.metadata);
    Object.freeze(this.nodes);
    Object.freeze(this.edges);
    Object.freeze(this.variables);
    Object.freeze(this.inputs);
    Object.freeze(this.outputs);
    Object.freeze(this);
  }

  static create(input: {
    metadata: CanonicalGraphMetadata;
    nodes: readonly CanonicalNode[];
    edges: readonly CanonicalEdge[];
    variables?: readonly CanonicalVariable[];
    inputs: readonly CanonicalPort[];
    outputs: readonly CanonicalPort[];
  }): CanonicalAutomationGraph {
    if (input.nodes.length === 0) throw new GraphConstructionFailed("Graph requires nodes");
    const nodes = [...input.nodes].sort((left, right) =>
      left.id.value.localeCompare(right.id.value),
    );
    if (new Set(nodes.map((node) => node.id.value)).size !== nodes.length)
      throw new GraphConstructionFailed("Graph node ids must be unique");
    const nodeIndex = new Map(nodes.map((node) => [node.id.value, node]));
    const edges = [...input.edges].sort((left, right) => {
      return (
        left.sourceNodeId.value.localeCompare(right.sourceNodeId.value) ||
        left.priority - right.priority ||
        left.id.value.localeCompare(right.id.value)
      );
    });
    if (new Set(edges.map((edge) => edge.id.value)).size !== edges.length)
      throw new GraphConstructionFailed("Graph edge ids must be unique");
    const routePriorities = new Set<string>();
    for (const edge of edges) {
      const source = nodeIndex.get(edge.sourceNodeId.value);
      const target = nodeIndex.get(edge.targetNodeId.value);
      if (!source || !target) throw new GraphConstructionFailed("Graph contains an orphan edge");
      if (!source.hasPort(edge.outputPort, PortDirection.Output))
        throw new GraphConstructionFailed("Graph edge output port does not exist");
      if (!target.hasPort(edge.inputPort, PortDirection.Input))
        throw new GraphConstructionFailed("Graph edge input port does not exist");
      const priorityKey = `${edge.sourceNodeId.value}:${edge.outputPort}:${edge.priority}`;
      if (routePriorities.has(priorityKey))
        throw new GraphConstructionFailed("Graph edge priorities must be unique per output port");
      routePriorities.add(priorityKey);
    }
    return new CanonicalAutomationGraph(
      input.metadata,
      Object.freeze(nodes),
      Object.freeze(edges),
      Object.freeze([...(input.variables ?? [])].sort((a, b) => a.id.localeCompare(b.id))),
      uniquePorts(input.inputs, PortDirection.Input),
      uniquePorts(input.outputs, PortDirection.Output),
    );
  }

  containsGeneratedElement(id: NodeId | EdgeId): boolean {
    return (
      this.nodes.some((node) => node.id.value === id.value) ||
      this.edges.some((edge) => edge.id.value === id.value)
    );
  }
}

function uniquePorts(
  ports: readonly CanonicalPort[],
  direction: PortDirection,
): readonly CanonicalPort[] {
  if (ports.some((port) => port.direction !== direction))
    throw new GraphConstructionFailed(`Port direction must be ${direction}`);
  if (new Set(ports.map((port) => port.id)).size !== ports.length)
    throw new GraphConstructionFailed("Port ids must be unique");
  return Object.freeze([...ports].sort((left, right) => left.id.localeCompare(right.id)));
}
