import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { logInfo } from "@/shared/infrastructure/logger";

const globalDatabase = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to initialize Prisma");
  }

  logInfo({ action: "database.client.init", ...describeDatabaseConnection(connectionString) });

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
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
    const username = decodeURIComponent(url.username || "");
    const projectRef =
      username.match(/^postgres\.([a-z0-9]+)$/i)?.[1] ??
      host.match(/(?:^|\.)([a-z0-9]{20})\.supabase\.co$/i)?.[1] ??
      "unknown";
    const mode = host.includes("pooler.supabase.com")
      ? port === "6543"
        ? "transaction-pooler"
        : "pooler"
      : host.startsWith("db.")
        ? "direct"
        : "other";

    return {
      databaseHost: host,
      databasePort: port,
      databaseUsername: username,
      databaseProjectRef: projectRef,
      databaseConnectionMode: mode,
    };
  } catch {
    return {
      databaseHost: "invalid-url",
      databasePort: "unknown",
      databaseUsername: "unknown",
      databaseProjectRef: "unknown",
      databaseConnectionMode: "unknown",
    };
  }
}
