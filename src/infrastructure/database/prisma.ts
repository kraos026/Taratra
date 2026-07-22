import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalDatabase = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to initialize Prisma");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

export function getPrismaClient(): PrismaClient {
  globalDatabase.prisma ??= createPrismaClient();
  return globalDatabase.prisma;
}
