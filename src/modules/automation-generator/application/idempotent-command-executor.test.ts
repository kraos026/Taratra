import { describe, expect, it } from "vitest";
import { AutomationGeneration } from "../domain/automation-generation";
import { ContentHash } from "../domain/automation-generator-value-objects";
import { requestInput } from "../domain/automation-generator-test-fixtures";
import {
  IdempotencyCommandInProgress,
  IdempotencyKeyConflict,
} from "./automation-generator-application-errors";
import { RequestAutomationGenerationCommand } from "./automation-generator-commands";
import {
  commandContext,
  completedRecord,
  dependencies,
} from "./automation-generator-application-test-fixtures";

function command(): RequestAutomationGenerationCommand {
  const context = commandContext();
  return new RequestAutomationGenerationCommand(
    context.tenantId,
    context.idempotencyKey,
    context.correlationId,
    requestInput().specification.id,
    requestInput().generatorVersion,
    requestInput().graphSchemaVersion,
    requestInput().ruleCatalogVersion,
  );
}

describe("IdempotentCommandExecutor", () => {
  it("reserves and completes a new command inside the transaction", async () => {
    const deps = dependencies();
    const expected = AutomationGeneration.request(requestInput()).snapshot();
    const operation = async () => expected;
    const result = await deps.idempotency.execute(
      deps.transaction.context,
      "RequestAutomationGeneration",
      command(),
      operation,
    );
    expect(result).toBe(expected);
    expect(deps.idempotencyStore).toMatchObject({ reserves: 1, completions: 1 });
  });

  it("replays a completed identical command without running the operation", async () => {
    const deps = dependencies();
    const expected = AutomationGeneration.request(requestInput()).snapshot();
    deps.idempotencyStore.record = completedRecord(expected);
    let operationCalls = 0;
    const result = await deps.idempotency.execute(
      deps.transaction.context,
      "RequestAutomationGeneration",
      command(),
      async () => {
        operationCalls += 1;
        return expected;
      },
    );
    expect(result).toBe(expected);
    expect(operationCalls).toBe(0);
    expect(deps.idempotencyStore.reserves).toBe(0);
  });

  it("rejects reuse with a different payload fingerprint", async () => {
    const deps = dependencies();
    const expected = AutomationGeneration.request(requestInput()).snapshot();
    deps.idempotencyStore.record = completedRecord(expected, ContentHash.create("d".repeat(64)));
    await expect(
      deps.idempotency.execute(
        deps.transaction.context,
        "RequestAutomationGeneration",
        command(),
        async () => expected,
      ),
    ).rejects.toBeInstanceOf(IdempotencyKeyConflict);
  });

  it("rejects a concurrent command still in progress", async () => {
    const deps = dependencies();
    deps.idempotencyStore.record = {
      state: "IN_PROGRESS",
      fingerprint: deps.hasher.value,
    };
    await expect(
      deps.idempotency.execute(
        deps.transaction.context,
        "RequestAutomationGeneration",
        command(),
        async () => AutomationGeneration.request(requestInput()).snapshot(),
      ),
    ).rejects.toBeInstanceOf(IdempotencyCommandInProgress);
  });
});
