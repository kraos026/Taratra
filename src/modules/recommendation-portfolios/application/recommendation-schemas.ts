import { z } from "zod";
export const recommendationPortfolioIdSchema = z.string().uuid();
export const recommendationPortfolioMutationSchema = z.object({
  lockVersion: z.number().int().positive(),
});
export const recommendationPortfolioListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["draft", "validated", "published", "archived"]).optional(),
  priority: z.enum(["critical", "high", "medium", "low", "future"]).optional(),
  category: z.string().optional(),
  phase: z.enum(["phase_1", "phase_2", "phase_3", "phase_4"]).optional(),
});
