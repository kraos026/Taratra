import { z } from "zod";

// User-attested provenance, not proof of authenticity or a new canonical fact.
export const documentSourceSchema = z
  .object({
    fileName: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .regex(/^[^\\/\x00-\x1f]+$/),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    location: z.string().min(1).max(100),
    excerpt: z.string().trim().min(1).max(4000),
    reviewed: z.literal(true),
  })
  .strict();

export type DocumentSource = z.infer<typeof documentSourceSchema>;
