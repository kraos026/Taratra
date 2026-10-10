import { createClient } from "@/infrastructure/supabase/server";
import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import {
  createPrivacyRequest,
  listPrivacyRequests,
  privacyRequestInput,
  PrivacyRequestError,
} from "@/modules/privacy/application/privacy-request-service";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";

export const dynamic = "force-dynamic";
function privateResponse(response: Response) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
async function handle(request?: Request) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (error || !userId) return apiError("UNAUTHENTICATED", "Connexion requise", 401);
    if (!request)
      return apiSuccess(
        await withAuthenticatedDatabase(userId, (db) => listPrivacyRequests(db, userId)),
      );
    // Same-origin browser form only; prevents cookie-based cross-site submissions.
    if (request.headers.get("origin") !== new URL(request.url).origin)
      return apiError("FORBIDDEN", "Origine de la demande invalide", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return apiError("VALIDATION_ERROR", "Format JSON requis", 400);
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > 8192)
      return apiError("VALIDATION_ERROR", "Demande trop volumineuse", 413);
    const input = privacyRequestInput.safeParse(JSON.parse(body));
    if (!input.success)
      return apiError(
        "VALIDATION_ERROR",
        "Vérifiez le type et la description (5 à 1 000 caractères).",
        400,
      );
    return apiSuccess(
      await withAuthenticatedDatabase(userId, (db) => createPrivacyRequest(db, userId, input.data)),
      201,
    );
  } catch (caught) {
    if (caught instanceof PrivacyRequestError)
      return apiError(caught.code, caught.message, caught.status);
    if (caught instanceof SyntaxError) return apiError("VALIDATION_ERROR", "JSON invalide", 400);
    // Database uniqueness is the final concurrency guard. No sensitive exception logging.
    if ((caught as { code?: string })?.code === "P2002")
      return apiError(
        "REQUEST_CONFLICT",
        "Une demande existe déjà. Actualisez le suivi avant de réessayer.",
        409,
      );
    return apiError(
      "INTERNAL_ERROR",
      "Le suivi des demandes est indisponible. Contactez le responsable par email.",
      500,
    );
  }
}
export async function GET() {
  return privateResponse(await handle());
}
export async function POST(request: Request) {
  return privateResponse(await handle(request));
}
