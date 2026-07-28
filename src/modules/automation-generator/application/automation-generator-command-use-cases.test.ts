import { describe, expect, it } from "vitest";
import { AutomationGeneration } from "../domain/automation-generation";
import { GenerationStatus } from "../domain/automation-generator-enums";
import {
  GenerationVersionConflict,
  GraphConstructionFailed,
} from "../domain/automation-generator-errors";
import { GenerationId, LockVersion } from "../domain/automation-generator-value-objects";
import {
  AutomationGenerationNotFound,
  PublishedGenerationRuleCatalogNotFound,
  PublishedSpecificationNotFound,
} from "./automation-generator-application-errors";
import {
  DeprecateAutomationGeneration,
  GenerateAutomationGraph,
  PublishAutomationGeneration,
  RebuildAutomationGeneration,
  RequestAutomationGeneration,
} from "./automation-generator-command-use-cases";
import {
  DeprecateAutomationGenerationCommand,
  GenerateAutomationGraphCommand,
  PublishAutomationGenerationCommand,
  RebuildAutomationGenerationCommand,
  RequestAutomationGenerationCommand,
} from "./automation-generator-commands";
import {
  commandContext,
  dependencies,
  generatedGeneration,
  publishedGeneration,
} from "./automation-generator-application-test-fixtures";
import { requestInput } from "../domain/automation-generator-test-fixtures";

describe("Automation Generator command use cases", () => {
  it("requests a generation inside one transaction through ports only", async () => {
    const deps = dependencies();
    const context = commandContext();
    const result = await new RequestAutomationGeneration(deps).execute(
      new RequestAutomationGenerationCommand(
        context.tenantId,
        context.idempotencyKey,
        context.correlationId,
        requestInput().specification.id,
        requestInput().generatorVersion,
        requestInput().graphSchemaVersion,
        requestInput().ruleCatalogVersion,
      ),
    );
    expect(result.status).toBe(GenerationStatus.Requested);
    expect(deps.transaction).toMatchObject({ opened: 1, committed: 1, rolledBack: 0 });
    expect(deps.specificationReader.calls).toBe(1);
    expect(deps.idFactory.generationIdCalls).toBe(1);
    expect(deps.idFactory.lineageIdCalls).toBe(1);
    expect(deps.repository.saves).toHaveLength(1);
    expect(deps.idempotencyStore).toMatchObject({ reserves: 1, completions: 1 });
  });

  it("rolls back the request when the published Specification is absent", async () => {
    const deps = dependencies();
    deps.specificationReader.snapshot = null;
    const context = commandContext();
    await expect(
      new RequestAutomationGeneration(deps).execute(
        new RequestAutomationGenerationCommand(
          context.tenantId,
          context.idempotencyKey,
          context.correlationId,
          "missing",
          requestInput().generatorVersion,
          requestInput().graphSchemaVersion,
          requestInput().ruleCatalogVersion,
        ),
      ),
    ).rejects.toBeInstanceOf(PublishedSpecificationNotFound);
    expect(deps.transaction).toMatchObject({ committed: 0, rolledBack: 1 });
    expect(deps.repository.saves).toHaveLength(0);
  });

  it("generates by delegating compilation and domain transition", async () => {
    const deps = dependencies();
    deps.repository.generation = AutomationGeneration.request(requestInput());
    const context = commandContext();
    const result = await new GenerateAutomationGraph(deps).execute(
      new GenerateAutomationGraphCommand(
        context.tenantId,
        context.idempotencyKey,
        context.correlationId,
        requestInput().generationId,
        LockVersion.create(1),
      ),
    );
    expect(result.status).toBe(GenerationStatus.Generated);
    expect(deps.compiler.calls).toHaveLength(1);
    expect(deps.ruleCatalog.calls).toBe(1);
    expect(deps.repository.saves).toHaveLength(1);
  });

  it("rolls back when the compiler port reports an error", async () => {
    const deps = dependencies();
    deps.repository.generation = AutomationGeneration.request(requestInput());
    deps.compiler.error = new GraphConstructionFailed("invalid graph");
    const context = commandContext();
    await expect(
      new GenerateAutomationGraph(deps).execute(
        new GenerateAutomationGraphCommand(
          context.tenantId,
          context.idempotencyKey,
          context.correlationId,
          requestInput().generationId,
          LockVersion.create(1),
        ),
      ),
    ).rejects.toBeInstanceOf(GraphConstructionFailed);
    expect(deps.transaction.rolledBack).toBe(1);
    expect(deps.repository.saves).toHaveLength(0);
  });

  it("rejects a stale optimistic version before saving", async () => {
    const deps = dependencies();
    deps.repository.generation = AutomationGeneration.request(requestInput());
    const context = commandContext();
    await expect(
      new GenerateAutomationGraph(deps).execute(
        new GenerateAutomationGraphCommand(
          context.tenantId,
          context.idempotencyKey,
          context.correlationId,
          requestInput().generationId,
          LockVersion.create(2),
        ),
      ),
    ).rejects.toBeInstanceOf(GenerationVersionConflict);
    expect(deps.transaction.rolledBack).toBe(1);
    expect(deps.repository.saves).toHaveLength(0);
  });

  it("rebuilds by delegating to the same compiler port", async () => {
    const deps = dependencies();
    deps.repository.generation = generatedGeneration();
    const context = commandContext();
    const result = await new RebuildAutomationGeneration(deps).execute(
      new RebuildAutomationGenerationCommand(
        context.tenantId,
        context.idempotencyKey,
        context.correlationId,
        requestInput().generationId,
        LockVersion.create(2),
      ),
    );
    expect(result.status).toBe(GenerationStatus.Generated);
    expect(result.lockVersion.value).toBe(3);
    expect(deps.compiler.calls).toHaveLength(1);
  });

  it("rejects generation when the published compatible catalog is absent", async () => {
    const deps = dependencies();
    deps.repository.generation = AutomationGeneration.request(requestInput());
    deps.ruleCatalog.catalog = null;
    const context = commandContext();
    await expect(
      new GenerateAutomationGraph(deps).execute(
        new GenerateAutomationGraphCommand(
          context.tenantId,
          context.idempotencyKey,
          context.correlationId,
          requestInput().generationId,
          LockVersion.create(1),
        ),
      ),
    ).rejects.toBeInstanceOf(PublishedGenerationRuleCatalogNotFound);
    expect(deps.compiler.calls).toHaveLength(0);
  });

  it("publishes and writes only approved domain events to the outbox", async () => {
    const deps = dependencies();
    deps.repository.generation = generatedGeneration();
    const context = commandContext();
    const result = await new PublishAutomationGeneration(deps).execute(
      new PublishAutomationGenerationCommand(
        context.tenantId,
        context.idempotencyKey,
        context.correlationId,
        requestInput().generationId,
        LockVersion.create(2),
      ),
    );
    expect(result.status).toBe(GenerationStatus.Published);
    expect(deps.outbox.events.map((event) => event.eventName)).toEqual([
      "AutomationGraphPublished",
    ]);
  });

  it("deprecates and appends AutomationGenerationDeprecated atomically", async () => {
    const deps = dependencies();
    deps.repository.generation = publishedGeneration();
    const context = commandContext();
    const result = await new DeprecateAutomationGeneration(deps).execute(
      new DeprecateAutomationGenerationCommand(
        context.tenantId,
        context.idempotencyKey,
        context.correlationId,
        requestInput().generationId,
        LockVersion.create(3),
      ),
    );
    expect(result.status).toBe(GenerationStatus.Deprecated);
    expect(deps.outbox.events.map((event) => event.eventName)).toEqual([
      "AutomationGenerationDeprecated",
    ]);
  });

  it("returns not found without invoking domain behavior", async () => {
    const deps = dependencies();
    const context = commandContext();
    await expect(
      new PublishAutomationGeneration(deps).execute(
        new PublishAutomationGenerationCommand(
          context.tenantId,
          context.idempotencyKey,
          context.correlationId,
          GenerationId.create("018f22e2-7c10-7a11-8c11-012345678999"),
          LockVersion.create(1),
        ),
      ),
    ).rejects.toBeInstanceOf(AutomationGenerationNotFound);
    expect(deps.transaction.rolledBack).toBe(1);
  });
});
