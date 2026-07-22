import { z } from "zod";
import { companySizes, companySortFields, companyStatuses } from "../domain/company";

const optionalText = (maximum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(maximum).optional(),
  );

const optionalEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().email().max(254).optional(),
);

const optionalWebsite = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z
    .string()
    .trim()
    .url()
    .max(2048)
    .refine((value) => value.startsWith("https://") || value.startsWith("http://"), {
      message: "Website must use http or https",
    })
    .optional(),
);

export const companyInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  sectorId: optionalText(120),
  employeeCount: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce.number().int().nonnegative().optional(),
  ),
  companySize: z.enum(companySizes).optional(),
  primaryContactName: optionalText(160),
  primaryContactRole: optionalText(160),
  phone: optionalText(60),
  email: optionalEmail,
  website: optionalWebsite,
  address: optionalText(500),
  city: optionalText(160),
  country: optionalText(160),
  description: optionalText(5000),
  internalNotes: optionalText(10000),
  status: z.enum(companyStatuses).default("prospect"),
});

export const companyUpdateSchema = companyInputSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const companyIdSchema = z.string().uuid();

const queryBoolean = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false" || value === undefined) return false;
  return value;
}, z.boolean());

export const companyListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: optionalText(160),
  status: z.enum(companyStatuses).optional(),
  companySize: z.enum(companySizes).optional(),
  sectorId: optionalText(120),
  sortBy: z.enum(companySortFields).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  includeArchived: queryBoolean.default(false),
});

export type CompanyInputData = z.infer<typeof companyInputSchema>;
export type CompanyUpdateData = z.infer<typeof companyUpdateSchema>;
export type CompanyListQueryData = z.infer<typeof companyListQuerySchema>;
