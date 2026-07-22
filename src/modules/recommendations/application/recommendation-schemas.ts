import { z } from "zod";
export const roiProfileInputSchema = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]{1,79}$/),
  name: z.string().min(2).max(120),
  currency: z.string().regex(/^[A-Z]{3}$/),
  hourlyCost: z.number().nonnegative(),
  workingDaysYear: z.number().positive(),
  workingHoursDay: z.number().positive(),
  active: z.boolean().default(true),
});
export const roiProfilePatchSchema = roiProfileInputSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0);
export const recommendationRunSchema = z.object({ roiProfileId: z.string().uuid() });
