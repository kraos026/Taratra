import type { CanonicalAutomationGraph } from "./canonical-automation-graph";
import {
  AutomationGenerationDeprecated,
  AutomationGraphPublished,
  type AutomationGeneratorDomainEvent,
} from "./automation-generator-domain-events";
import { CapabilityClassification, GenerationStatus } from "./automation-generator-enums";
import {
  CrossTenantAccessDenied,
  GenerationInvariantViolation,
  GenerationVersionConflict,
  InvalidLifecycleTransition,
  SpecificationNotPublished,
  UnsupportedCapability,
} from "./automation-generator-errors";
import type { GenerationExplanation, GenerationProvenance } from "./generation-provenance";
import {
  CatalogVersion,
  ContentHash,
  GenerationId,
  GenerationLineageId,
  GenerationVersion,
  GeneratorVersion,
  GraphSchemaVersion,
  LockVersion,
  TenantId,
} from "./automation-generator-value-objects";

export interface AutomationSpecificationSnapshotReference {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly lineageId: string;
  readonly version: number;
  readonly status: "PUBLISHED" | "UNPUBLISHED";
  readonly contentHash: ContentHash;
}

export interface PreviousAutomationGenerationReference {
  readonly tenantId: TenantId;
  readonly lineageId: GenerationLineageId;
  readonly specificationLineageId: string;
  readonly generationVersion: GenerationVersion;
  readonly specificationVersion: number;
}

export interface AutomationGenerationRequest {
  readonly tenantId: TenantId;
  readonly generationId: GenerationId;
  readonly lineageId: GenerationLineageId;
  readonly generationVersion: GenerationVersion;
  readonly specification: AutomationSpecificationSnapshotReference;
  readonly generatorVersion: GeneratorVersion;
  readonly graphSchemaVersion: GraphSchemaVersion;
  readonly ruleCatalogVersion: CatalogVersion;
  readonly createdAt: Date;
  readonly previousGeneration?: PreviousAutomationGenerationReference;
}

export interface AutomationGenerationRehydration {
  readonly tenantId: TenantId;
  readonly generationId: GenerationId;
  readonly lineageId: GenerationLineageId;
  readonly generationVersion: GenerationVersion;
  readonly lockVersion: LockVersion;
  readonly specification: AutomationSpecificationSnapshotReference;
  readonly generatorVersion: GeneratorVersion;
  readonly graphSchemaVersion: GraphSchemaVersion;
  readonly ruleCatalogVersion: CatalogVersion;
  readonly status: GenerationStatus;
  readonly isLatestVersion: boolean;
  readonly graph: CanonicalAutomationGraph | null;
  readonly provenance: readonly GenerationProvenance[];
  readonly explanations: readonly GenerationExplanation[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly generatedAt: string | null;
  readonly publishedAt: string | null;
  readonly deprecatedAt: string | null;
}

export interface AutomationGenerationSnapshot extends AutomationGenerationRehydration {
  readonly contentHash: ContentHash | null;
}

export class AutomationGeneration {
  private domainEvents: AutomationGeneratorDomainEvent[] = [];

  private constructor(private state: AutomationGenerationRehydration) {}

  static request(input: AutomationGenerationRequest): AutomationGeneration {
    if (input.specification.status !== "PUBLISHED") throw new SpecificationNotPublished();
    if (!input.tenantId.equals(input.specification.tenantId)) throw new CrossTenantAccessDenied();
    validateDate(input.createdAt);
    validateSpecificationIdentity(input.specification);
    validateLineage(input);
    const now = input.createdAt.toISOString();
    return new AutomationGeneration({
      tenantId: input.tenantId,
      generationId: input.generationId,
      lineageId: input.lineageId,
      generationVersion: input.generationVersion,
      lockVersion: LockVersion.create(1),
      specification: input.specification,
      generatorVersion: input.generatorVersion,
      graphSchemaVersion: input.graphSchemaVersion,
      ruleCatalogVersion: input.ruleCatalogVersion,
      status: GenerationStatus.Requested,
      isLatestVersion: true,
      graph: null,
      provenance: Object.freeze([]),
      explanations: Object.freeze([]),
      createdAt: now,
      updatedAt: now,
      generatedAt: null,
      publishedAt: null,
      deprecatedAt: null,
    });
  }

  static rehydrate(state: AutomationGenerationRehydration): AutomationGeneration {
    return new AutomationGeneration({
      ...state,
      provenance: Object.freeze([...state.provenance]),
      explanations: Object.freeze([...state.explanations]),
    });
  }

  generate(input: GenerationResult, expectedVersion: LockVersion, occurredAt: Date): void {
    this.assertExpectedVersion(expectedVersion);
    this.assertLatest();
    if (this.state.status !== GenerationStatus.Requested)
      throw new InvalidLifecycleTransition(this.state.status, GenerationStatus.Generated);
    this.applyGeneratedResult(input, occurredAt);
  }

  rebuild(input: GenerationResult, expectedVersion: LockVersion, occurredAt: Date): void {
    this.assertExpectedVersion(expectedVersion);
    this.assertLatest();
    if (this.state.status !== GenerationStatus.Generated)
      throw new InvalidLifecycleTransition(this.state.status, GenerationStatus.Generated);
    this.applyGeneratedResult(input, occurredAt);
  }

  publish(expectedVersion: LockVersion, occurredAt: Date): void {
    this.assertCanPublish(expectedVersion);
    const now = timestamp(occurredAt);
    this.state = {
      ...this.state,
      status: GenerationStatus.Published,
      lockVersion: this.state.lockVersion.next(),
      updatedAt: now,
      publishedAt: now,
    };
    this.domainEvents.push(
      new AutomationGraphPublished(
        this.state.tenantId,
        this.state.generationId,
        this.state.lineageId,
        this.state.generationVersion,
        this.requiredGraph().metadata.contentHash,
        now,
      ),
    );
  }

  deprecate(expectedVersion: LockVersion, occurredAt: Date): void {
    this.assertExpectedVersion(expectedVersion);
    this.assertLatest();
    if (this.state.status !== GenerationStatus.Published)
      throw new InvalidLifecycleTransition(this.state.status, GenerationStatus.Deprecated);
    const now = timestamp(occurredAt);
    this.state = {
      ...this.state,
      status: GenerationStatus.Deprecated,
      lockVersion: this.state.lockVersion.next(),
      updatedAt: now,
      deprecatedAt: now,
    };
    this.domainEvents.push(
      new AutomationGenerationDeprecated(
        this.state.tenantId,
        this.state.generationId,
        this.state.lineageId,
        this.state.generationVersion,
        now,
      ),
    );
  }

  assertCanPublish(expectedVersion: LockVersion): void {
    this.assertExpectedVersion(expectedVersion);
    this.assertLatest();
    if (this.state.status !== GenerationStatus.Generated)
      throw new InvalidLifecycleTransition(this.state.status, GenerationStatus.Published);
    this.validateGeneratedState();
  }

  snapshot(): Readonly<AutomationGenerationSnapshot> {
    return Object.freeze({
      ...this.state,
      provenance: Object.freeze([...this.state.provenance]),
      explanations: Object.freeze([...this.state.explanations]),
      contentHash: this.state.graph?.metadata.contentHash ?? null,
    });
  }

  pullDomainEvents(): readonly AutomationGeneratorDomainEvent[] {
    const events = Object.freeze([...this.domainEvents]);
    this.domainEvents = [];
    return events;
  }

  private applyGeneratedResult(input: GenerationResult, occurredAt: Date): void {
    if (input.unsupportedCapabilityCodes.length > 0)
      throw new UnsupportedCapability(input.unsupportedCapabilityCodes);
    this.assertGraphIdentity(input.graph);
    assertProvenance(input.graph, input.provenance);
    const now = timestamp(occurredAt);
    this.state = {
      ...this.state,
      status: GenerationStatus.Generated,
      lockVersion: this.state.lockVersion.next(),
      graph: input.graph,
      provenance: Object.freeze([...input.provenance]),
      explanations: Object.freeze([...input.explanations]),
      updatedAt: now,
      generatedAt: now,
    };
  }

  private validateGeneratedState(): void {
    this.requiredGraph();
    if (this.state.provenance.length === 0)
      throw new GenerationInvariantViolation("Generated graph requires provenance");
    assertProvenance(this.requiredGraph(), this.state.provenance);
  }

  private assertGraphIdentity(graph: CanonicalAutomationGraph): void {
    const metadata = graph.metadata;
    if (
      !metadata.generationId.equals(this.state.generationId) ||
      !metadata.lineageId.equals(this.state.lineageId) ||
      !metadata.generationVersion.equals(this.state.generationVersion) ||
      metadata.automationSpecificationSnapshotId !== this.state.specification.id ||
      metadata.automationSpecificationVersion !== this.state.specification.version ||
      !metadata.automationSpecificationContentHash.equals(this.state.specification.contentHash) ||
      !metadata.generatorVersion.equals(this.state.generatorVersion) ||
      !metadata.graphSchemaVersion.equals(this.state.graphSchemaVersion) ||
      !metadata.ruleCatalogVersion.equals(this.state.ruleCatalogVersion)
    )
      throw new GenerationInvariantViolation(
        "Canonical graph metadata does not match Automation Generation",
      );
  }

  private assertExpectedVersion(expectedVersion: LockVersion): void {
    if (!this.state.lockVersion.equals(expectedVersion)) throw new GenerationVersionConflict();
  }

  private assertLatest(): void {
    if (!this.state.isLatestVersion)
      throw new GenerationInvariantViolation("Only the latest generation version can transition");
  }

  private requiredGraph(): CanonicalAutomationGraph {
    if (!this.state.graph)
      throw new GenerationInvariantViolation("Automation Generation does not contain a graph");
    return this.state.graph;
  }
}

export interface GenerationResult {
  readonly graph: CanonicalAutomationGraph;
  readonly provenance: readonly GenerationProvenance[];
  readonly explanations: readonly GenerationExplanation[];
  readonly unsupportedCapabilityCodes: readonly string[];
}

export class AutomationGenerationPublisher {
  publish(input: {
    candidate: AutomationGeneration;
    candidateExpectedVersion: LockVersion;
    previousActive?: AutomationGeneration;
    previousExpectedVersion?: LockVersion;
    occurredAt: Date;
  }): void {
    input.candidate.assertCanPublish(input.candidateExpectedVersion);
    if (input.previousActive) {
      if (!input.previousExpectedVersion)
        throw new GenerationInvariantViolation(
          "Supersession requires the previous active lock version",
        );
      const candidate = input.candidate.snapshot();
      const previous = input.previousActive.snapshot();
      if (
        !candidate.tenantId.equals(previous.tenantId) ||
        !candidate.lineageId.equals(previous.lineageId)
      )
        throw new GenerationInvariantViolation(
          "Supersession requires the same tenant and generation lineage",
        );
      if (candidate.generationVersion.value <= previous.generationVersion.value)
        throw new GenerationInvariantViolation("Supersession requires a newer generation version");
      input.previousActive.deprecate(input.previousExpectedVersion, input.occurredAt);
    }
    input.candidate.publish(input.candidateExpectedVersion, input.occurredAt);
  }
}

function validateLineage(input: AutomationGenerationRequest): void {
  const previous = input.previousGeneration;
  if (!previous) {
    if (input.generationVersion.value !== 1)
      throw new GenerationInvariantViolation("A new generation lineage must start at version 1");
    return;
  }
  if (!input.tenantId.equals(previous.tenantId)) throw new CrossTenantAccessDenied();
  if (!input.lineageId.equals(previous.lineageId))
    throw new GenerationInvariantViolation("Generation lineage cannot change between versions");
  if (input.specification.lineageId !== previous.specificationLineageId)
    throw new GenerationInvariantViolation(
      "A different Specification lineage requires a new Generation lineage",
    );
  if (input.generationVersion.value !== previous.generationVersion.value + 1)
    throw new GenerationInvariantViolation("Generation version must increment by exactly one");
  if (input.specification.version <= previous.specificationVersion)
    throw new GenerationInvariantViolation(
      "A new generation version requires a newer Specification version",
    );
}

function validateSpecificationIdentity(
  specification: AutomationSpecificationSnapshotReference,
): void {
  if (!specification.id.trim() || !specification.lineageId.trim())
    throw new GenerationInvariantViolation("Specification reference is invalid");
  if (!Number.isInteger(specification.version) || specification.version < 1)
    throw new GenerationInvariantViolation("Specification version is invalid");
}

function assertProvenance(
  graph: CanonicalAutomationGraph,
  provenance: readonly GenerationProvenance[],
): void {
  const classifiedCapabilities = new Map<string, Set<CapabilityClassification>>();
  for (const entry of provenance) {
    if (entry.generatedElementId && !graph.containsGeneratedElement(entry.generatedElementId))
      throw new GenerationInvariantViolation("Provenance targets an unknown generated element");
    if (entry.capabilityCode) {
      const classifications =
        classifiedCapabilities.get(entry.capabilityCode) ?? new Set<CapabilityClassification>();
      classifications.add(entry.classification);
      classifiedCapabilities.set(entry.capabilityCode, classifications);
    }
  }
  for (const node of graph.nodes) {
    for (const capability of node.definition.capabilityCodes) {
      const classifications = classifiedCapabilities.get(capability);
      if (
        !classifications ||
        (!classifications.has(CapabilityClassification.Consumed) &&
          !classifications.has(CapabilityClassification.Transformed))
      )
        throw new GenerationInvariantViolation(
          `Consumed capability ${capability} is missing from provenance`,
        );
      if (classifications.has(CapabilityClassification.Ignored))
        throw new GenerationInvariantViolation(
          `Consumed capability ${capability} cannot be classified as ignored`,
        );
    }
  }
}

function validateDate(value: Date): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime()))
    throw new GenerationInvariantViolation("Lifecycle timestamp is invalid");
}

function timestamp(value: Date): string {
  validateDate(value);
  return value.toISOString();
}
