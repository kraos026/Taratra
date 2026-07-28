import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import type {
  ApplicationTransaction,
  TransactionPort,
} from "../application/automation-generator-application-ports";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export class PrismaTransactionRegistry {
  private readonly clients = new Map<string, TransactionClient>();

  register(transactionId: string, client: TransactionClient): void {
    if (this.clients.has(transactionId)) throw new Error("Transaction is already registered");
    this.clients.set(transactionId, client);
  }

  resolve(transaction: ApplicationTransaction): TransactionClient {
    const client = this.clients.get(transaction.transactionId);
    if (!client) throw new Error("Prisma transaction is not active");
    return client;
  }

  release(transactionId: string): void {
    this.clients.delete(transactionId);
  }
}

export interface AuthenticatedDatabaseContext {
  userId(): string;
}

export class PrismaTransactionManager implements TransactionPort {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly registry: PrismaTransactionRegistry,
    private readonly securityContext: AuthenticatedDatabaseContext,
  ) {}

  execute<TResult>(
    operation: (transaction: ApplicationTransaction) => Promise<TResult>,
  ): Promise<TResult> {
    return this.prisma.$transaction(async (client) => {
      const userId = this.securityContext.userId();
      await client.$executeRaw`select set_config('request.jwt.claim.sub', ${userId}, true)`;
      await client.$executeRawUnsafe("set local role authenticated");
      const transaction = Object.freeze({ transactionId: randomUUID() });
      this.registry.register(transaction.transactionId, client);
      try {
        return await operation(transaction);
      } finally {
        this.registry.release(transaction.transactionId);
      }
    });
  }
}
