import { describe, expect, it } from "vitest";
import { AutomationGeneration, AutomationGenerationPublisher } from "./automation-generation";
import { GenerationStatus } from "./automation-generator-enums";
import {
  CrossTenantAccessDenied,
  GenerationInvariantViolation,
  GenerationVersionConflict,
  InvalidLifecycleTransition,
  SpecificationNotPublished,
  UnsupportedCapability,
} from "./automation-generator-errors";
import {
  generationResult,
  ids,
  requestInput,
  requestedGeneration,
} from "./automation-generator-test-fixtures";
import {
  GenerationId,
  GenerationVersion,
  LockVersion,
  TenantId,
} from "./automation-generator-value-objects";

const generatedAt = new Date("2026-01-01T00:01:00.000Z");
const publishedAt = new Date("2026-01-01T00:02:00.000Z");
const deprecatedAt = new Date("2026-01-01T00:03:00.000Z");

describe("AutomationGeneration Aggregate", () => {
  it("creates a requested first version from a published Specification", () => {
    const snapshot = requestedGeneration().snapshot();
    expect(snapshot.status).toBe(GenerationStatus.Requested);
    expect(snapshot.generationVersion.value).toBe(1);
    expect(snapshot.lockVersion.value).toBe(1);
    expect(snapshot.graph).toBeNull();
  });

  it("rejects an unpublished Specification before creating the Aggregate", () => {
    const input = requestInput();
    expect(() =>
      AutomationGeneration.request({
        ...input,
        specification: { ...input.specification, status: "UNPUBLISHED" },
      }),
    ).toThrow(SpecificationNotPublished);
  });

  it("rejects a source belonging to another tenant", () => {
    const input = requestInput();
    expect(() =>
      AutomationGeneration.request({
        ...input,
        specification: {
          ...input.specification,
          tenantId: TenantId.create("018f22e2-7c10-7a11-8c11-012345678999"),
        },
      }),
    ).toThrow(CrossTenantAccessDenied);
  });

  it("generates a complete graph and increments optimistic locking", () => {
    const generation = requestedGeneration();
    generation.generate(generationResult(), LockVersion.create(1), generatedAt);
    const snapshot = generation.snapshot();
    expect(snapshot.status).toBe(GenerationStatus.Generated);
    expect(snapshot.lockVersion.value).toBe(2);
    expect(snapshot.generatedAt).toBe(generatedAt.toISOString());
    expect(snapshot.contentHash?.value).toBe("b".repeat(64));
  });

  it("rebuilds only a generated latest version and replaces its candidate", () => {
    const generation = requestedGeneration();
    generation.generate(generationResult(), LockVersion.create(1), generatedAt);
    generation.rebuild(
      generationResult(),
      LockVersion.create(2),
      new Date("2026-01-01T00:01:30.000Z"),
    );
    expect(generation.snapshot().lockVersion.value).toBe(3);
  });

  it("publishes only a generated graph and emits AutomationGraphPublished", () => {
    const generation = requestedGeneration();
    expect(() => generation.publish(LockVersion.create(1), publishedAt)).toThrow(
      InvalidLifecycleTransition,
    );
    generation.generate(generationResult(), LockVersion.create(1), generatedAt);
    generation.publish(LockVersion.create(2), publishedAt);
    expect(generation.snapshot().status).toBe(GenerationStatus.Published);
    expect(generation.pullDomainEvents()).toMatchObject([
      { eventName: "AutomationGraphPublished", contentHash: { value: "b".repeat(64) } },
    ]);
  });

  it("deprecates only a published version and emits AutomationGenerationDeprecated", () => {
    const generation = requestedGeneration();
    generation.generate(generationResult(), LockVersion.create(1), generatedAt);
    generation.publish(LockVersion.create(2), publishedAt);
    generation.pullDomainEvents();
    generation.deprecate(LockVersion.create(3), deprecatedAt);
    expect(generation.snapshot().status).toBe(GenerationStatus.Deprecated);
    expect(generation.pullDomainEvents()).toMatchObject([
      { eventName: "AutomationGenerationDeprecated" },
    ]);
  });

  it("enforces the complete lifecycle transition matrix", () => {
    const requested = requestedGeneration();
    expect(() => requested.rebuild(generationResult(), LockVersion.create(1), generatedAt)).toThrow(
      InvalidLifecycleTransition,
    );
    expect(() => requested.deprecate(LockVersion.create(1), deprecatedAt)).toThrow(
      InvalidLifecycleTransition,
    );

    const generated = requestedGeneration();
    generated.generate(generationResult(), LockVersion.create(1), generatedAt);
    expect(() =>
      generated.generate(generationResult(), LockVersion.create(2), generatedAt),
    ).toThrow(InvalidLifecycleTransition);
    expect(() => generated.deprecate(LockVersion.create(2), deprecatedAt)).toThrow(
      InvalidLifecycleTransition,
    );

    const published = requestedGeneration();
    published.generate(generationResult(), LockVersion.create(1), generatedAt);
    published.publish(LockVersion.create(2), publishedAt);
    expect(() => published.rebuild(generationResult(), LockVersion.create(3), generatedAt)).toThrow(
      InvalidLifecycleTransition,
    );
    expect(() => published.publish(LockVersion.create(3), publishedAt)).toThrow(
      InvalidLifecycleTransition,
    );

    published.deprecate(LockVersion.create(3), deprecatedAt);
    expect(() => published.deprecate(LockVersion.create(4), deprecatedAt)).toThrow(
      InvalidLifecycleTransition,
    );
  });

  it("rejects stale optimistic lock versions", () => {
    expect(() =>
      requestedGeneration().generate(generationResult(), LockVersion.create(2), generatedAt),
    ).toThrow(GenerationVersionConflict);
  });

  it("refuses unsupported capabilities without changing the Aggregate", () => {
    const generation = requestedGeneration();
    expect(() =>
      generation.generate(
        { ...generationResult(), unsupportedCapabilityCodes: ["cap.unsupported"] },
        LockVersion.create(1),
        generatedAt,
      ),
    ).toThrow(UnsupportedCapability);
    expect(generation.snapshot()).toMatchObject({
      status: GenerationStatus.Requested,
      lockVersion: { value: 1 },
      graph: null,
    });
  });

  it("rejects transitions of a superseded generation version", () => {
    const generation = AutomationGeneration.rehydrate({
      ...requestedGeneration().snapshot(),
      isLatestVersion: false,
    });
    expect(() =>
      generation.generate(generationResult(), LockVersion.create(1), generatedAt),
    ).toThrow(GenerationInvariantViolation);
  });

  it("requires a new lineage to start at generation version one", () => {
    expect(() =>
      AutomationGeneration.request(
        requestInput({ generationVersion: GenerationVersion.create(2) }),
      ),
    ).toThrow("start at version 1");
  });

  it("creates the next version only inside the same lineages", () => {
    const previous = {
      tenantId: TenantId.create(ids.tenant),
      lineageId: requestInput().lineageId,
      specificationLineageId: "specification-lineage",
      generationVersion: GenerationVersion.create(1),
      specificationVersion: 1,
    };
    const input = requestInput({
      generationId: GenerationId.create(ids.secondGeneration),
      generationVersion: GenerationVersion.create(2),
      specification: { ...requestInput().specification, version: 2 },
      previousGeneration: previous,
    });
    expect(AutomationGeneration.request(input).snapshot().generationVersion.value).toBe(2);
    expect(() =>
      AutomationGeneration.request({
        ...input,
        specification: { ...input.specification, lineageId: "different-lineage" },
      }),
    ).toThrow("different Specification lineage");
  });

  it("atomically models supersession through the publication domain service", () => {
    const previous = requestedGeneration();
    previous.generate(generationResult(), LockVersion.create(1), generatedAt);
    previous.publish(LockVersion.create(2), publishedAt);

    const nextInput = requestInput({
      generationId: GenerationId.create(ids.secondGeneration),
      generationVersion: GenerationVersion.create(2),
      specification: { ...requestInput().specification, version: 2 },
      previousGeneration: {
        tenantId: requestInput().tenantId,
        lineageId: requestInput().lineageId,
        specificationLineageId: "specification-lineage",
        generationVersion: GenerationVersion.create(1),
        specificationVersion: 1,
      },
    });
    const next = AutomationGeneration.request(nextInput);
    next.generate(generationResult(nextInput), LockVersion.create(1), generatedAt);

    new AutomationGenerationPublisher().publish({
      candidate: next,
      candidateExpectedVersion: LockVersion.create(2),
      previousActive: previous,
      previousExpectedVersion: LockVersion.create(3),
      occurredAt: deprecatedAt,
    });

    expect(previous.snapshot().status).toBe(GenerationStatus.Deprecated);
    expect(next.snapshot().status).toBe(GenerationStatus.Published);
  });
});
