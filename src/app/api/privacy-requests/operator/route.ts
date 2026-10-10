import { z } from "zod";
import { createClient } from "@/infrastructure/supabase/server";
import { getPrismaClient } from "@/infrastructure/database/prisma";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
import { PrivacyRequestError } from "@/modules/privacy/application/privacy-request-service";
import {
  privacyOperatorInput,
  privacyOperatorTargetAllowed,
} from "@/modules/privacy/application/privacy-operator-policy";
import {
  authorizePrivacyOperator,
  listOperatorPrivacyRequests,
  updateOperatorPrivacyRequest,
} from "@/modules/privacy/application/privacy-operator-service";

export const dynamic = "force-dynamic";
async function handle(request?: Request) {
  if (!privacyOperatorTargetAllowed(process.env))
    return apiError("NOT_FOUND", "Fonction indisponible dans cet environnement.", 404);
  try {
    const supabase = await createClient();
    const claims = await supabase.auth.getClaims();
    const userId = claims.data?.claims?.sub;
    const sessionId = claims.data?.claims?.session_id;
    if (
      claims.error ||
      !z.string().uuid().safeParse(userId).success ||
      !z.string().uuid().safeParse(sessionId).success
    )
      return apiError("UNAUTHENTICATED", "Connexion requise.", 401);
    const user = await supabase.auth.getUser();
    if (user.error || user.data.user?.id !== userId)
      return apiError("UNAUTHENTICATED", "Connexion requise.", 401);
    let input: z.infer<typeof privacyOperatorInput> | undefined;
    if (request) {
      if (request.headers.get("origin") !== new URL(request.url).origin)
        return apiError("FORBIDDEN", "Origine invalide.", 403);
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        return apiError("VALIDATION_ERROR", "Format JSON requis.", 400);
      const body = await request.text();
      if (Buffer.byteLength(body, "utf8") > 8192)
        return apiError("VALIDATION_ERROR", "Demande trop volumineuse.", 413);
      const parsed = privacyOperatorInput.safeParse(JSON.parse(body));
      if (!parsed.success)
        return apiError(
          "VALIDATION_ERROR",
          "Statut, version et réponse de 5 à 2 000 caractères requis.",
          400,
        );
      input = parsed.data;
    }
    const result = await getPrismaClient().$transaction(async (db) => {
      await authorizePrivacyOperator(db, userId!, sessionId as string);
      return input
        ? updateOperatorPrivacyRequest(db, userId!, input)
        : listOperatorPrivacyRequests(db);
    });
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof PrivacyRequestError)
      return apiError(error.code, error.message, error.status);
    if (error instanceof SyntaxError) return apiError("VALIDATION_ERROR", "JSON invalide.", 400);
    // Never log database exceptions: their parameters may contain private responses.
    return apiError(
      "INTERNAL_ERROR",
      "Traitement indisponible. Aucune réussite ne peut être confirmée.",
      500,
    );
  }
}
function privateResponse(response: Response) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
export async function GET() {
  return privateResponse(await handle());
}
export async function PATCH(request: Request) {
  return privateResponse(await handle(request));
}
