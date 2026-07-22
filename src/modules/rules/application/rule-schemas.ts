import { z } from "zod";
import { ruleOperators, type RuleCondition } from "../domain/rule";

const factValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number().finite(), z.boolean(), z.null(), z.array(factValueSchema)]),
);
const leafSchema = z
  .object({
    fact: z.string().trim().min(1).max(120),
    operator: z.enum(ruleOperators),
    value: factValueSchema.optional(),
  })
  .superRefine((value, context) => {
    const valueLess = ["isEmpty", "isNotEmpty"].includes(value.operator);
    if (!valueLess && value.value === undefined)
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "Value is required for this operator",
      });
    if (valueLess && value.value !== undefined)
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "Value is not allowed for this operator",
      });
    if (["in", "notIn"].includes(value.operator) && !Array.isArray(value.value))
      context.addIssue({ code: "custom", path: ["value"], message: "Value must be an array" });
  });
export const ruleConditionSchema: z.ZodType<RuleCondition> = z.lazy(() =>
  z.union([
    leafSchema,
    z.object({ all: z.array(ruleConditionSchema).min(1) }).strict(),
    z.object({ any: z.array(ruleConditionSchema).min(1) }).strict(),
    z.object({ none: z.array(ruleConditionSchema).min(1) }).strict(),
  ]),
) as z.ZodType<RuleCondition>;

export const ruleInputSchema = z.object({
  categoryId: z.string().uuid(),
  code: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9_]{1,119}$/),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).optional(),
  priority: z.number().int().positive().default(100),
  severity: z.enum(["info", "low", "medium", "high", "critical"]),
  weight: z.number().finite().nonnegative(),
  conditionJson: ruleConditionSchema,
  resultJson: z.record(z.string(), z.unknown()).default({}),
  active: z.boolean().default(true),
  version: z.number().int().positive().default(1),
});
export const ruleUpdateSchema = ruleInputSchema
  .pick({ name: true, description: true, priority: true, active: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0);
export const ruleVersionInputSchema = ruleInputSchema.omit({ code: true, version: true });
export const ruleListSchema = z.object({
  active: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});
export const idSchema = z.string().uuid();
