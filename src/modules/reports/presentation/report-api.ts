import { createClient } from "@/infrastructure/supabase/server";
import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { apiError } from "@/shared/presentation/api-response";
import { ReportService } from "../application/report-service";
import { PrismaReportRepository } from "../infrastructure/prisma-report-repository";
export async function withReportService<T>(
  operation: (service: ReportService) => Promise<T>,
): Promise<T | Response> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);
  try {
    return await withAuthenticatedDatabase(userId, (db) =>
      operation(new ReportService(new PrismaReportRepository(db), userId)),
    );
  } catch (caught) {
    const code = caught instanceof Error ? caught.message : "INTERNAL_ERROR";
    return apiError(
      code,
      code === "NOT_FOUND"
        ? "Report not found"
        : code === "FORBIDDEN"
          ? "Forbidden"
          : "Unexpected error",
      code === "NOT_FOUND" ? 404 : code === "FORBIDDEN" ? 403 : 500,
    );
  }
}
