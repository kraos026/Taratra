import { z } from "zod";
import { questionTypes, versionStatuses } from "../domain/questionnaire";
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional(),
  );
const jsonObject = z.record(z.string(), z.unknown()).default({});
export const questionnaireInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: optionalText(5000),
  category: z.string().trim().min(1).max(120),
});
export const questionnaireUpdateSchema = questionnaireInputSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0);
export const questionnaireListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: optionalText(160),
  category: optionalText(120),
  status: z.enum(versionStatuses).optional(),
  isSystem: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  sortBy: z.enum(["name", "category", "createdAt", "updatedAt"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
export const sectionInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: optionalText(5000),
  position: z.coerce.number().int().positive(),
});
export const moveInputSchema = z.object({
  operation: z.literal("move"),
  position: z.coerce.number().int().positive(),
});
export const questionInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z][A-Za-z0-9_.-]{1,119}$/),
    label: z.string().trim().min(1).max(500),
    description: optionalText(5000),
    questionType: z.enum(questionTypes),
    required: z.boolean().default(false),
    position: z.coerce.number().int().positive(),
    optionsJson: z
      .array(z.union([z.string(), z.number(), z.boolean()]))
      .min(1)
      .optional(),
    validationJson: jsonObject,
    metadataJson: jsonObject,
  })
  .superRefine((v, ctx) => {
    const choice = ["single_choice", "multiple_choice"].includes(v.questionType);
    if (choice !== Boolean(v.optionsJson))
      ctx.addIssue({
        code: "custom",
        message: choice ? "Options are required" : "Options are only allowed for choices",
        path: ["optionsJson"],
      });
  });
export const idSchema = z.string().uuid();
