import { z } from "zod";

export const skillSchema = z.object({
  name: z.string().min(1).max(120),
  description: z
    .string()
    .max(4000)
    .optional()
    .default("")
    .transform((text) => text.slice(0, 500)),
});
export const toolsetSchema = z.object({
  name: z.string().min(1).max(120),
  label: z.string().max(200).optional(),
  enabled: z.boolean().nullable().optional().default(null),
  configured: z.boolean().nullable().optional().default(null),
});
const state = z.enum(["available", "unconfigured", "unlinked", "unavailable"]);
export const hermesInventorySchema = z.object({
  checkedAt: z.string().datetime(),
  skills: z.object({ state, items: z.array(skillSchema).max(100) }),
  toolsets: z.object({ state, items: z.array(toolsetSchema).max(100) }),
  modelCalls: z.literal(0),
});
export type HermesInventory = z.infer<typeof hermesInventorySchema>;
