import { z } from "zod";
export const aiOpportunityIdSchema = z.string().uuid();
export const aiOpportunityMutationSchema = z.object({ lockVersion: z.number().int().positive() });
export const aiOpportunityListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["draft", "validated", "published", "archived"]).optional(),
  capability: z.string().trim().min(1).max(120).optional(),
  risk: z.enum(["low", "medium", "high", "critical"]).optional(),
});
