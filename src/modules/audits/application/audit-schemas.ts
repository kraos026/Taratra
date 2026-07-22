import { z } from "zod";
export const auditCreateSchema = z.object({
  companyId: z.string().uuid(),
  questionnaireVersionId: z.string().uuid(),
});
export const auditUpdateSchema = z
  .object({ currentSectionId: z.string().uuid().nullable().optional() })
  .refine((v) => Object.keys(v).length > 0);
export const answerSchema = z.object({ value: z.unknown() });
export const auditListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  companyId: z.string().uuid().optional(),
  status: z.enum(["draft", "in_progress", "completed", "validated", "archived"]).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "progressPercentage", "status"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
