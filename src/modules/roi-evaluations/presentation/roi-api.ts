import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { apiError } from "@/shared/presentation/api-response";
import { RoiEvaluationEngine, type AssumptionCode } from "../domain/roi-engine";
import { RoiEvaluationError } from "../application/roi-errors";
import { RoiEvaluationService } from "../application/roi-service";
import {
  prepareRoiPersistencePlan,
  PrismaRoiEvaluationRepository,
} from "../infrastructure/prisma-roi-evaluation-repository";

const ROI_WRITE_TRANSACTION_OPTIONS = {
  timeout: 10_000,
} as const;

type RoiAssumptionRequest = {
  currency: string;
  suppliedAssumptions: Partial<Record<AssumptionCode, number>>;
  unknownAssumptions: AssumptionCode[];
};

export async function withRoiEvaluationService<T>(
  operation: (service: RoiEvaluationService) => Promise<T>,
): Promise<T | Response> {
  const userId = await authenticatedUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);
  try {
    return await withAuthenticatedDatabase(userId, (db) =>
      operation(new RoiEvaluationService(new PrismaRoiEvaluationRepository(db), userId)),
    );
  } catch (caught) {
    if (caught instanceof RoiEvaluationError)
      return apiError(caught.code, caught.message, caught.status);
    return apiError("INTERNAL_ERROR", "Unexpected error", 500);
  }
}

export async function evaluateRoiSnapshot(
  automationSnapshotId: string,
  request: RoiAssumptionRequest,
) {
  return executeRoiWriteCommand("evaluate", async (service) =>
    service.evaluateInput(automationSnapshotId, request),
  );
}

export async function rebuildRoiSnapshot(id: string, lockVersion: number) {
  return executeRoiWriteCommand("rebuild", async (service) =>
    service.rebuildInput(id, lockVersion),
  );
}

export async function reviseRoiSnapshot(
  id: string,
  request: RoiAssumptionRequest & { lockVersion: number },
) {
  return executeRoiWriteCommand("evaluate", async (service) => service.reviseInput(id, request));
}

async function executeRoiWriteCommand(
  mode: "evaluate" | "rebuild",
  prepare: (
    service: RoiEvaluationService,
  ) => Promise<Awaited<ReturnType<RoiEvaluationService["evaluateInput"]>>>,
) {
  const userId = await authenticatedUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);

  try {
    const prepared = await withAuthenticatedDatabase(userId, (db) =>
      prepare(new RoiEvaluationService(new PrismaRoiEvaluationRepository(db), userId)),
    );
    const engine = new RoiEvaluationEngine();
    const result =
      mode === "rebuild" ? engine.rebuild(prepared.input) : engine.evaluate(prepared.input);
    const plan = prepareRoiPersistencePlan(prepared.organizationId, prepared.input, result);

    return await withAuthenticatedDatabase(
      userId,
      (db) =>
        new RoiEvaluationService(new PrismaRoiEvaluationRepository(db), userId).persistPrepared(
          prepared,
          plan,
        ),
      ROI_WRITE_TRANSACTION_OPTIONS,
    );
  } catch (caught) {
    if (caught instanceof RoiEvaluationError)
      return apiError(caught.code, caught.message, caught.status);
    return apiError("INTERNAL_ERROR", "Unexpected error", 500);
  }
}

async function authenticatedUserId() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  return error ? null : (data?.claims?.sub ?? null);
}
