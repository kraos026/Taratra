import { z } from "zod";

export const automationSpecificationIdSchema = z.string().uuid();

export const specificationTransitionSchema = z.object({
  lockVersion: z.number().int().positive(),
});

export const specificationListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["draft", "validated", "published", "archived"]).optional(),
  latestPublished: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});
