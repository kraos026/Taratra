import type {
  ApplicationTransaction,
  ContentHasherPort,
  IdempotencyScope,
  IdempotencyStorePort,
} from "./automation-generator-application-ports";
import type { MutatingAutomationGeneratorCommand } from "./automation-generator-commands";
import {
  IdempotencyCommandInProgress,
  IdempotencyKeyConflict,
} from "./automation-generator-application-errors";

export class IdempotentCommandExecutor {
  constructor(
    private readonly idempotencyStore: IdempotencyStorePort,
    private readonly contentHasher: ContentHasherPort,
  ) {}

  async execute<TResult>(
    transaction: ApplicationTransaction,
    commandName: string,
    command: MutatingAutomationGeneratorCommand,
    operation: () => Promise<TResult>,
  ): Promise<TResult> {
    const scope: IdempotencyScope = {
      tenantId: command.tenantId.value,
      commandName,
      key: command.idempotencyKey.value,
    };
    const fingerprint = this.contentHasher.fingerprint(commandName, command);
    const existing = await this.idempotencyStore.find<TResult>(transaction, scope);

    if (existing) {
      if (!existing.fingerprint.equals(fingerprint)) throw new IdempotencyKeyConflict();
      if (existing.state === "IN_PROGRESS") throw new IdempotencyCommandInProgress();
      return existing.result;
    }

    await this.idempotencyStore.reserve(transaction, scope, fingerprint);
    const result = await operation();
    await this.idempotencyStore.complete(transaction, scope, fingerprint, result);
    return result;
  }
}
