import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "./prisma";
import { logError } from "@/shared/infrastructure/logger";

export type TransactionClient = Prisma.TransactionClient;
export type AuthenticatedDatabaseTransactionOptions = Parameters<
  ReturnType<typeof getPrismaClient>["$transaction"]
>[1];

export async function withAuthenticatedDatabase<Result>(
  userId: string,
  operation: (database: TransactionClient) => Promise<Result>,
  options?: AuthenticatedDatabaseTransactionOptions,
): Promise<Result> {
  try {
    return await getPrismaClient().$transaction(async (transaction: Prisma.TransactionClient) => {
      await transaction.$executeRaw`select set_config('request.jwt.claim.sub', ${userId}, true)`;

      // Constant SQL is required because PostgreSQL does not parameterize role identifiers.
      await transaction.$executeRawUnsafe("set local role authenticated");

      const result = await operation(transaction);
      return result;
    }, options);
  } catch (caught) {
    logError({
      action: "database.authenticated.failed",
      ...describeDatabaseException(caught),
    });
    throw caught;
  }
}

function describeDatabaseException(caught: unknown): Record<string, string> {
  const error = caught as {
    name?: string;
    code?: string;
    message?: string;
    meta?: { code?: string; cause?: string };
  };

  return {
    exceptionName: error.name ?? "UnknownError",
    prismaCode: error.code ?? "unknown",
    postgresCode: error.meta?.code ?? "unknown",
    exceptionMessage: sanitizeErrorMessage(error.message ?? "unknown"),
    exceptionCause: sanitizeErrorMessage(error.meta?.cause ?? "unknown"),
  };
}

function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/[^ \n\r\t]+/gi, "[REDACTED_DATABASE_URL]")
    .replace(/password[^,\n\r]*/gi, "password [REDACTED]")
    .slice(0, 500);
}
