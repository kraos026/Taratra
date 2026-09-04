import { z } from "zod";

const rating = z.number().int().min(1).max(5);

export const pilotFeedbackInputSchema = z
  .object({
    companyId: z.string().uuid(),
    understandingScore: rating,
    recommendationRelevanceScore: rating,
    roiCredibilityScore: rating,
    nextStepClarityScore: rating,
    experienceScore: rating,
    willingToPay: z.enum(["YES", "NO", "UNSURE"]),
    acceptablePrice: z.number().positive().max(1000000000).optional(),
    priceCurrency: z.string().trim().length(3).toUpperCase().optional(),
    comment: z.string().trim().max(2000).optional(),
  })
  .superRefine((value, context) => {
    if ((value.acceptablePrice === undefined) !== (value.priceCurrency === undefined)) {
      context.addIssue({
        code: "custom",
        message: "Le prix et la devise doivent être renseignés ensemble.",
        path: [value.acceptablePrice === undefined ? "acceptablePrice" : "priceCurrency"],
      });
    }
  });

export const pilotFeedbackQuerySchema = z.object({ companyId: z.string().uuid() });

export type PilotFeedbackInput = z.infer<typeof pilotFeedbackInputSchema>;

export type PilotFeedbackView = PilotFeedbackInput & {
  id: string;
  auditId: string | null;
  executiveResultId: string | null;
  contextStatus: "AUDIT_IN_PROGRESS" | "AUDIT_COMPLETE";
  createdAt: string;
  updatedAt: string;
};
