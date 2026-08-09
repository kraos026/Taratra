import { z } from "zod";
import type { AssumptionCode } from "../domain/roi-engine";
const value = z.number().finite().nonnegative();
const knownAssumption = z.object({ status: z.literal("known"), value }).strict();
const unknownAssumption = z.object({ status: z.literal("unknown") }).strict();
const publicAssumption = z.union([value, knownAssumption, unknownAssumption]);
export const roiIdSchema = z.string().uuid();
export const roiMutationSchema = z.object({ lockVersion: z.number().int().positive() });
export const roiEvaluateSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  assumptions: z.object({
    hourly_cost: publicAssumption,
    working_days: publicAssumption,
    working_hours: publicAssumption,
    monthly_frequency: publicAssumption,
    annual_frequency: publicAssumption,
    hours_saved_per_occurrence: publicAssumption,
    implementation_cost: publicAssumption,
    maintenance_cost: publicAssumption,
    training_cost: publicAssumption,
    infrastructure_cost: publicAssumption,
    error_cost: publicAssumption,
  }),
});
export type RoiEvaluateRequest = z.infer<typeof roiEvaluateSchema>;

export function normalizeRoiAssumptions(assumptions: RoiEvaluateRequest["assumptions"]) {
  const suppliedAssumptions: Partial<Record<AssumptionCode, number>> = {};
  const unknownAssumptions: AssumptionCode[] = [];
  for (const [code, assumption] of Object.entries(assumptions) as [
    AssumptionCode,
    RoiEvaluateRequest["assumptions"][AssumptionCode],
  ][]) {
    if (typeof assumption === "number") suppliedAssumptions[code] = assumption;
    else if (assumption.status === "known") suppliedAssumptions[code] = assumption.value;
    else unknownAssumptions.push(code);
  }
  return { suppliedAssumptions, unknownAssumptions };
}
export const roiListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["draft", "validated", "published", "archived"]).optional(),
  scenario: z.enum(["conservative", "expected", "optimistic"]).optional(),
});
