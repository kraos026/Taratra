import { z } from "zod";
const text = z.string().trim().min(1).max(500);
const nullableText = z.string().trim().max(2000).nullable().optional();
export const discoveryStepSchema = z.enum([
  "company",
  "business",
  "organization",
  "software",
  "processes",
  "review",
]);
const company = z.object({
  step: z.literal("company"),
  industry: text,
  countryCode: z
    .string()
    .length(2)
    .transform((v) => v.toUpperCase()),
  employeeCount: z.number().int().nonnegative(),
  description: nullableText,
});
const business = z
  .object({
    step: z.literal("business"),
    businessModel: text,
    growthStage: text,
    revenueAmount: z.number().nonnegative().nullable(),
    revenueCurrency: z
      .string()
      .length(3)
      .transform((v) => v.toUpperCase())
      .nullable(),
    revenueYear: z.number().int().min(1900).max(2200).nullable(),
    offerings: z
      .array(
        z.object({ type: z.enum(["product", "service"]), name: text, description: nullableText }),
      )
      .max(100),
    objectives: z
      .array(
        z.object({
          title: text,
          description: nullableText,
          priority: z.number().int().min(1).max(5),
          targetDate: z.string().date().nullable(),
        }),
      )
      .max(50),
    challenges: z
      .array(
        z.object({
          title: text,
          description: nullableText,
          severity: z.number().int().min(1).max(5),
        }),
      )
      .max(50),
  })
  .superRefine((v, c) => {
    if ((v.revenueAmount === null) !== (v.revenueCurrency === null))
      c.addIssue({
        code: "custom",
        message: "Revenue amount and currency must be provided together",
      });
  });
const organization = z.object({
  step: z.literal("organization"),
  departments: z
    .array(
      z.object({
        clientId: z.string(),
        name: text,
        description: nullableText,
        headcount: z.number().int().nonnegative().nullable(),
      }),
    )
    .max(100),
  roles: z
    .array(
      z.object({
        departmentClientId: z.string().nullable(),
        title: text,
        headcount: z.number().int().nonnegative(),
        responsibilities: z.array(text).max(30),
      }),
    )
    .max(200),
});
const software = z.object({
  step: z.literal("software"),
  items: z
    .array(
      z.object({
        name: text,
        purpose: nullableText,
        criticality: z.number().int().min(1).max(5).nullable(),
        usersCount: z.number().int().nonnegative().nullable(),
      }),
    )
    .max(200),
});
const processes = z.object({
  step: z.literal("processes"),
  items: z
    .array(
      z.object({
        name: text,
        categoryCode: z.string().min(2).max(80),
        description: nullableText,
        frequency: z.string().max(120).nullable(),
        volume: z.number().nonnegative().nullable(),
        manualHoursMonth: z.number().nonnegative().nullable(),
        painPoints: z.array(text).max(30),
      }),
    )
    .max(200),
});
const review = z.object({ step: z.literal("review"), confirmed: z.literal(true) });
export const discoveryPayloadSchema = z.union([
  company,
  business,
  organization,
  software,
  processes,
  review,
]);
export const discoveryAutosaveSchema = z.object({
  lockVersion: z.number().int().positive(),
  payload: discoveryPayloadSchema,
});
export type DiscoveryPayload = z.infer<typeof discoveryPayloadSchema>;
