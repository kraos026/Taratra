import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { apiError } from "@/shared/presentation/api-response";
import { EnterpriseKnowledgeService } from "../application/enterprise-knowledge-service";
import type { PreparedEnterpriseKnowledgeBuild } from "../application/enterprise-knowledge-service";
import { KnowledgeProjectionError } from "../application/knowledge-errors";
import { PrismaKnowledgeRepository } from "../infrastructure/prisma-knowledge-repository";

const KNOWLEDGE_WRITE_TRANSACTION_OPTIONS = {
  timeout: 10_000,
} as const;

interface EnterpriseKnowledgeBuildService {
  build(companyId: string): ReturnType<EnterpriseKnowledgeService["build"]>;
}

export async function withEnterpriseKnowledgeService<T>(
  operation: (service: EnterpriseKnowledgeBuildService) => Promise<T>,
): Promise<T | Response> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);

  try {
    return await operation({
      build: (companyId) => buildKnowledgeSnapshot(userId, companyId),
    });
  } catch (caught) {
    if (caught instanceof KnowledgeProjectionError)
      return apiError(caught.code, caught.message, caught.status);
    return apiError("INTERNAL_ERROR", "Unexpected error", 500);
  }
}

async function buildKnowledgeSnapshot(userId: string, companyId: string) {
  const readInput = await withAuthenticatedDatabase(userId, (database) =>
    new EnterpriseKnowledgeService(new PrismaKnowledgeRepository(database), userId).readBuildInput(
      companyId,
    ),
  );

  const prepared = EnterpriseKnowledgeService.preparePersistencePlan(readInput);

  return persistPreparedKnowledgeBuild(userId, prepared);
}

async function persistPreparedKnowledgeBuild(
  userId: string,
  prepared: PreparedEnterpriseKnowledgeBuild,
) {
  return withAuthenticatedDatabase(
    userId,
    (database) =>
      new EnterpriseKnowledgeService(
        new PrismaKnowledgeRepository(database),
        userId,
      ).persistPreparedBuild(prepared),
    KNOWLEDGE_WRITE_TRANSACTION_OPTIONS,
  );
}
