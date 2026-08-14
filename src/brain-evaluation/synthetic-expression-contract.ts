import { z } from "zod";

export interface SyntheticExpressionEnvelope {
  readonly expressionId: string;
  readonly task: string;
  readonly content: string;
  readonly language: string;
  readonly speakerRole: string;
  readonly claims: readonly string[];
  readonly unknowns: readonly string[];
  readonly terminology: Readonly<Record<string, string>>;
  readonly warnings: readonly string[];
}

const schema = z.object({
  expressionId: z.string().min(1),
  task: z.string().min(1),
  content: z.string().min(1),
  language: z.string().min(1),
  speakerRole: z.string().min(1),
  claims: z.array(z.string()).default([]),
  unknowns: z.array(z.string()).default([]),
  terminology: z.record(z.string()).default({}),
  warnings: z.array(z.string()).default([]),
});

export type SyntheticExpressionParseFailure = "EMPTY_CONTENT" | "INVALID_JSON" | "SCHEMA_MISMATCH";

export class SyntheticExpressionParseError extends Error {
  constructor(
    readonly code: SyntheticExpressionParseFailure,
    message: string,
  ) {
    super(message);
    this.name = "SyntheticExpressionParseError";
  }
}

export function parseSyntheticExpressionEnvelope(
  raw: string,
  expectedSpeakerRole?: string,
): SyntheticExpressionEnvelope {
  if (!raw.trim())
    throw new SyntheticExpressionParseError(
      "EMPTY_CONTENT",
      "Synthetic expression content is empty",
    );
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SyntheticExpressionParseError("INVALID_JSON", "Synthetic expression JSON is invalid");
  }
  const result = schema.safeParse(parsed);
  if (!result.success)
    throw new SyntheticExpressionParseError(
      "SCHEMA_MISMATCH",
      "Synthetic expression envelope schema mismatch",
    );
  if (expectedSpeakerRole && result.data.speakerRole !== expectedSpeakerRole)
    throw new SyntheticExpressionParseError(
      "SCHEMA_MISMATCH",
      "Synthetic expression speaker role mismatch",
    );
  return Object.freeze({
    ...result.data,
    claims: Object.freeze([...result.data.claims]),
    unknowns: Object.freeze([...result.data.unknowns]),
    terminology: Object.freeze({ ...result.data.terminology }),
    warnings: Object.freeze([...result.data.warnings]),
  });
}
