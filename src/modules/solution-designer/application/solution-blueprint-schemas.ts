import { z } from "zod";
export const solutionBlueprintIdSchema = z.string().uuid();
export const solutionBlueprintMutationSchema = z.object({
  lockVersion: z.number().int().positive(),
});
export const solutionBlueprintListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["draft", "validated", "published", "archived"]).optional(),
});
