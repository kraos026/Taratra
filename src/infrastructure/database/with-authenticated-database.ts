import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "./prisma";
import { logError, logInfo } from "@/shared/infrastructure/logger";

export type TransactionClient = Prisma.TransactionClient;

export async function withAuthenticatedDatabase<Result>(
  userId: string,
  operation: (database: TransactionClient) => Promise<Result>,
): Promise<Result> {
  logInfo({ action: "database.authenticated.enter", userId });

  try {
    return await getPrismaClient().$transaction(async (transaction: Prisma.TransactionClient) => {
      logInfo({ action: "database.transaction.entered", userId });
      await transaction.$executeRaw`select set_config('request.jwt.claim.sub', ${userId}, true)`;
      logInfo({ action: "database.jwt_context.set", userId });

      // Constant SQL is required because PostgreSQL does not parameterize role identifiers.
      await transaction.$executeRawUnsafe("set local role authenticated");
      logInfo({ action: "database.role_context.set", userId });

      const result = await operation(transaction);
      logInfo({ action: "database.operation.completed", userId });
      return result;
    });
  } catch (caught) {
    logError({
      action: "database.authenticated.failed",
      userId,
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
