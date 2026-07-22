import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { getPrismaClient } from "./prisma";

export type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export async function withAuthenticatedDatabase<Result>(
  userId: string,
  operation: (database: TransactionClient) => Promise<Result>,
): Promise<Result> {
  return getPrismaClient().$transaction(async (transaction: Prisma.TransactionClient) => {
    await transaction.$executeRaw`select set_config('request.jwt.claim.sub', ${userId}, true)`;

    // Constant SQL is required because PostgreSQL does not parameterize role identifiers.
    await transaction.$executeRawUnsafe("set local role authenticated");

    return operation(transaction);
  });
}
