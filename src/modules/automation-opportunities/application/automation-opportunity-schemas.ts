import { z } from "zod";
export const automationOpportunityIdSchema = z.string().uuid();
export const automationOpportunityMutationSchema = z.object({
  lockVersion: z.number().int().positive(),
});
export const automationOpportunityListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["draft", "validated", "published", "archived"]).optional(),
  pattern: z.string().trim().min(1).max(120).optional(),
  connector: z.string().trim().min(1).max(120).optional(),
});
