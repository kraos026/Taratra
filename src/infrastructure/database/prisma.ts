import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { logInfo } from "@/shared/infrastructure/logger";
import { databasePoolConfig } from "./supabase-tls";

const globalDatabase = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to initialize Prisma");
  }

  const poolConfig = databasePoolConfig(connectionString);
  logInfo({ action: "database.client.init", ...describeDatabaseConnection(connectionString) });

  return new PrismaClient({
    adapter: new PrismaPg(poolConfig),
  });
}

export function getPrismaClient(): PrismaClient {
  globalDatabase.prisma ??= createPrismaClient();
  return globalDatabase.prisma;
}

function describeDatabaseConnection(connectionString: string): Record<string, string> {
  try {
    const url = new URL(connectionString);
    const host = url.hostname;
    const port = url.port || "default";
    const mode = host.includes("pooler.supabase.com")
      ? port === "6543"
        ? "transaction-pooler"
        : "pooler"
      : host.startsWith("db.")
        ? "direct"
        : "other";

    return {
      databaseConnectionMode: mode,
    };
  } catch {
    return {
      databaseConnectionMode: "unknown",
    };
  }
}
