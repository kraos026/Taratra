import { z } from "zod";
const value = z.number().finite().nonnegative();
export const roiIdSchema = z.string().uuid();
export const roiMutationSchema = z.object({ lockVersion: z.number().int().positive() });
export const roiEvaluateSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  assumptions: z.object({
    hourly_cost: value,
    working_days: value,
    working_hours: value,
    monthly_frequency: value,
    annual_frequency: value,
    hours_saved_per_occurrence: value,
    implementation_cost: value,
    maintenance_cost: value,
    training_cost: value,
    infrastructure_cost: value,
    error_cost: value,
  }),
});
export const roiListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["draft", "validated", "published", "archived"]).optional(),
  scenario: z.enum(["conservative", "expected", "optimistic"]).optional(),
});
