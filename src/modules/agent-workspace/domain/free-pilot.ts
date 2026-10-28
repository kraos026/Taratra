import { z } from "zod";

export const freeMissionInput = z
  .object({ id: z.string().uuid(), prompt: z.string().trim().min(10).max(2000) })
  .strict();
export const freeReviewInput = z
  .object({
    id: z.string().uuid(),
    decision: z.enum(["accepted", "changes_requested"]),
    comment: z.string().trim().max(500),
    previousId: z.string().uuid().nullable(),
  })
  .strict()
  .refine((value) => value.decision !== "changes_requested" || value.comment.length >= 10);
export const freeMissionSchema = z.object({
  id: z.string().uuid(),
  prompt: z.string().max(2000),
  status: z.enum([
    "queued",
    "running",
    "completed",
    "failed",
    "stopping",
    "stopped",
    "interrupted",
  ]),
  created_at: z.number().finite(),
  updated_at: z.number().finite(),
  reviews: z
    .array(
      z.object({
        id: z.string().uuid(),
        decision: z.enum(["accepted", "changes_requested"]),
        comment: z.string().max(500),
        created_at: z.number().finite(),
      }),
    )
    .max(20)
    .default([]),
  output: z.string().max(12000).nullable(),
  error: z.string().max(500).nullable(),
  proof: z
    .object({
      model: z.string().max(200),
      verifiedApiCostUsd: z.literal("0"),
      llmRequests: z.number().int().min(1).max(2),
      verifiedResponses: z.number().int().min(1).max(2),
      tools: z.literal(0),
      fallbacks: z.literal(0),
      runtime: z.literal("Hermes AIAgent"),
    })
    .nullable(),
});
export const freeMissionListSchema = z.object({
  items: z.array(freeMissionSchema).max(20),
  hasMore: z.boolean(),
});
export type FreeMission = z.infer<typeof freeMissionSchema>;
export const freePilotReadinessSchema = z.object({
  state: z.literal("ready"),
  toolsAllowed: z.literal(0),
  fallbackAllowed: z.literal(false),
  policy: z.object({
    model: z
      .string()
      .max(200)
      .regex(/:free$/),
    checkedAt: z.number().finite(),
    pricing: z.record(z.string()),
  }),
});
