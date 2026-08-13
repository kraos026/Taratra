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

  logInfo({ action: "database.runtime", error: describeDatabaseUrl(connectionString) });

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

export function getPrismaClient(): PrismaClient {
  globalDatabase.prisma ??= createPrismaClient();
  return globalDatabase.prisma;
}

function describeDatabaseUrl(connectionString: string): string {
  try {
    const parsed = new URL(connectionString);
    const host = parsed.hostname;
    const port = parsed.port || "default";
    const username = decodeURIComponent(parsed.username);
    const projectRef = host.includes("supabase.co")
      ? (host.match(/(?:db\.|pooler\.|^)([a-z0-9]{20})/)?.[1] ?? "unknown")
      : "unknown";
    const mode = host.includes("pooler.supabase.com")
      ? port === "6543"
        ? "transaction-pooler"
        : port === "5432"
          ? "session-pooler"
          : "pooler-other"
      : host.startsWith("db.")
        ? "direct"
        : "other";
    return `host=${host};port=${port};username=${username};project=${projectRef};mode=${mode}`;
  } catch {
    return "invalid-database-url";
  }
}
