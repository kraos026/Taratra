import {
  pilotFeedbackInputSchema,
  pilotFeedbackQuerySchema,
} from "@/modules/pilot-feedback/application/pilot-feedback-schema";
import { withPilotFeedbackService } from "@/modules/pilot-feedback/presentation/pilot-feedback-api";
import { apiError } from "@/shared/presentation/api-response";

export async function GET(request: Request) {
  const query = pilotFeedbackQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) return apiError("VALIDATION_ERROR", "Requête invalide", 400);
  return withPilotFeedbackService((service) => service.get(query.data.companyId));
}

export async function POST(request: Request) {
  const payload: unknown = await request.json().catch(() => null);
  const input = pilotFeedbackInputSchema.safeParse(payload);
  if (!input.success) return apiError("VALIDATION_ERROR", "Avis invalide", 400);
  return withPilotFeedbackService((service) => service.save(input.data));
}

export const PATCH = POST;
