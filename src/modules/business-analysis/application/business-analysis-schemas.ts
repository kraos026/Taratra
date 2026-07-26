import { z } from "zod";

export const analysisIdSchema = z.string().uuid();
export const analysisMutationSchema = z.object({ lockVersion: z.number().int().positive() });
export const analysisListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["draft", "validated", "published", "archived"]).optional(),
  severity: z.enum(["critical", "high", "medium", "low", "information"]).optional(),
  category: z.string().trim().min(1).max(120).optional(),
});
