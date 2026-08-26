import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { apiError } from "@/shared/presentation/api-response";
import { AutomationSpecificationEngine } from "../domain/automation-specification-engine";
import { AutomationSpecificationError } from "../application/automation-specification-errors";
import { AutomationSpecificationService } from "../application/automation-specification-service";
import {
  prepareAutomationSpecificationPersistencePlan,
  PrismaAutomationSpecificationRepository,
} from "../infrastructure/prisma-automation-specification-repository";

const AUTOMATION_SPECIFICATION_WRITE_TRANSACTION_OPTIONS = {
  timeout: 10_000,
} as const;

export async function withAutomationSpecificationService<T>(
  operation: (service: AutomationSpecificationService) => Promise<T>,
): Promise<T | Response> {
  const userId = await authenticatedUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);
  try {
    return await withAuthenticatedDatabase(userId, (database) =>
      operation(
        new AutomationSpecificationService(
          new PrismaAutomationSpecificationRepository(database),
          userId,
        ),
      ),
    );
  } catch (caught) {
    if (caught instanceof AutomationSpecificationError)
      return apiError(caught.code, caught.message, caught.status);
    return apiError("INTERNAL_ERROR", "Unexpected error", 500);
  }
}

export async function generateAutomationSpecification(solutionBlueprintId: string) {
  return executeAutomationSpecificationWriteCommand("generate", async (service) =>
    service.generateInput(solutionBlueprintId),
  );
}

export async function rebuildAutomationSpecification(id: string, lockVersion: number) {
  return executeAutomationSpecificationWriteCommand("rebuild", async (service) =>
    service.rebuildInput(id, lockVersion),
  );
}

async function executeAutomationSpecificationWriteCommand(
  mode: "generate" | "rebuild",
  prepare: (
    service: AutomationSpecificationService,
  ) => Promise<Awaited<ReturnType<AutomationSpecificationService["generateInput"]>>>,
) {
  const userId = await authenticatedUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);

  try {
    const prepared = await withAuthenticatedDatabase(userId, (database) =>
      prepare(
        new AutomationSpecificationService(
          new PrismaAutomationSpecificationRepository(database),
          userId,
        ),
      ),
    );
    const engine = new AutomationSpecificationEngine();
    const result =
      mode === "rebuild" ? engine.rebuild(prepared.input) : engine.generate(prepared.input);
    const plan = prepareAutomationSpecificationPersistencePlan(
      prepared.organizationId,
      userId,
      prepared.input,
      result,
    );
    const snapshot = await withAuthenticatedDatabase(
      userId,
      (database) =>
        new AutomationSpecificationService(
          new PrismaAutomationSpecificationRepository(database),
          userId,
        ).persistPrepared(prepared, plan),
      AUTOMATION_SPECIFICATION_WRITE_TRANSACTION_OPTIONS,
    );
    return await withAuthenticatedDatabase(userId, (database) =>
      new AutomationSpecificationService(
        new PrismaAutomationSpecificationRepository(database),
        userId,
      ).get(snapshot.id),
    );
  } catch (caught) {
    if (caught instanceof AutomationSpecificationError)
      return apiError(caught.code, caught.message, caught.status);
    return apiError("INTERNAL_ERROR", "Unexpected error", 500);
  }
}

async function authenticatedUserId() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  return error ? null : (data?.claims?.sub ?? null);
}
