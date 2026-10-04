import { z } from "zod";
import { documentSourceSchema } from "../domain/document-source";

export const interviewIdSchema = z.string().uuid();
export const interviewAnswerSchema = z.object({
  lockVersion: z.number().int().positive(),
  questionId: z.string().uuid(),
  value: z.unknown(),
  confidence: z.enum(["confirmed", "uncertain"]),
  documentSource: documentSourceSchema.optional(),
});
export const interviewSkipSchema = z.object({
  lockVersion: z.number().int().positive(),
  questionId: z.string().uuid(),
  reason: z.enum(["irrelevant", "unknown", "deferred"]),
});
export const interviewBackSchema = z.object({
  lockVersion: z.number().int().positive(),
  questionId: z.string().uuid(),
});
