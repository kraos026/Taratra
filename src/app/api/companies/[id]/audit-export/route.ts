import { createClient } from "@/infrastructure/supabase/server";
import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { companyIdSchema } from "@/modules/companies/application/company-schemas";
import {
  exportAuditSources,
  ExportLimitError,
} from "@/modules/companies/application/audit-source-export";
import { CompanyError } from "@/modules/companies/domain/company-errors";
import { apiError } from "@/shared/presentation/api-response";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const response = await download((await context.params).id);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

async function download(rawId: string): Promise<Response> {
  const id = companyIdSchema.safeParse(rawId);
  if (!id.success) return apiError("VALIDATION_ERROR", "Identifiant d’entreprise invalide", 400);
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (error || !userId) return apiError("UNAUTHENTICATED", "Connexion requise", 401);
    const result = await withAuthenticatedDatabase(userId, (db) =>
      exportAuditSources(db, userId, id.data),
    );
    const body = JSON.stringify(result, null, 2);
    if (Buffer.byteLength(body, "utf8") > 10 * 1024 * 1024) throw new ExportLimitError();
    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="optivos-sources-audit-${id.data}.json"`,
      },
    });
  } catch (caught) {
    if (caught instanceof CompanyError) return apiError(caught.code, caught.message, caught.status);
    if (caught instanceof ExportLimitError)
      return apiError(
        "EXPORT_LIMIT",
        "Export trop volumineux : contactez le responsable. Aucun fichier partiel fourni.",
        409,
      );
    // No raw exception/content is logged for this sensitive download.
    return apiError("INTERNAL_ERROR", "Le téléchargement n’a pas pu être préparé", 500);
  }
}
