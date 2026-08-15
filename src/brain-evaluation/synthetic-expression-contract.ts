import { z } from "zod";

export const SYNTHETIC_EXPRESSION_TASKS = [
  "INTERVIEW",
  "FOLLOW_UP",
  "EMAIL",
  "SOP",
  "MEETING_NOTES",
  "PROCESS_DESCRIPTION",
] as const;
export const SYNTHETIC_EXPRESSION_ROLES = [
  "OWNER",
  "EXECUTIVE",
  "MANAGER",
  "OPERATOR",
  "FINANCE",
  "IT",
  "PROCESS_OWNER",
  "CUSTOMER_SERVICE",
  "ANALYST",
  "DOCUMENT",
] as const;
export type SyntheticExpressionTask = (typeof SYNTHETIC_EXPRESSION_TASKS)[number];
export type SyntheticExpressionRole = (typeof SYNTHETIC_EXPRESSION_ROLES)[number];

export interface SyntheticExpressionEnvelope {
  readonly expressionId: string;
  readonly task: SyntheticExpressionTask;
  readonly content: string;
  readonly language: string;
  readonly speakerRole: SyntheticExpressionRole;
  readonly claims: readonly string[];
  readonly unknowns: readonly string[];
  readonly terminology: Readonly<Record<string, string>>;
  readonly warnings: readonly string[];
}

export const SYNTHETIC_EXPRESSION_JSON_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: [
    "expressionId",
    "task",
    "content",
    "language",
    "speakerRole",
    "claims",
    "unknowns",
    "terminology",
    "warnings",
  ],
  properties: {
    expressionId: { type: "string", minLength: 1 },
    task: { type: "string", enum: [...SYNTHETIC_EXPRESSION_TASKS] },
    content: { type: "string", minLength: 1 },
    language: { type: "string", minLength: 1 },
    speakerRole: { type: "string", enum: [...SYNTHETIC_EXPRESSION_ROLES] },
    claims: { type: "array", items: { type: "string" } },
    unknowns: { type: "array", items: { type: "string" } },
    terminology: { type: "object", additionalProperties: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
  },
});

const schema = z
  .object({
    expressionId: z.string().min(1),
    task: z.enum(SYNTHETIC_EXPRESSION_TASKS),
    content: z.string().min(1),
    language: z.string().min(1),
    speakerRole: z.enum(SYNTHETIC_EXPRESSION_ROLES),
    claims: z.array(z.string()),
    unknowns: z.array(z.string()),
    terminology: z.record(z.string()),
    warnings: z.array(z.string()),
  })
  .strict();

export type SyntheticExpressionParseFailure = "EMPTY_CONTENT" | "INVALID_JSON" | "SCHEMA_MISMATCH";
export interface SyntheticExpressionSchemaIssue {
  readonly path: string;
  readonly expected: string;
  readonly actual: string;
  readonly reason: string;
}

export class SyntheticExpressionParseError extends Error {
  constructor(
    readonly code: SyntheticExpressionParseFailure,
    message: string,
    readonly issues: readonly SyntheticExpressionSchemaIssue[] = [],
  ) {
    super(message);
    this.name = "SyntheticExpressionParseError";
  }
}

const actualType = (value: unknown) =>
  Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
export function parseSyntheticExpressionEnvelope(
  raw: string,
  expectedSpeakerRole?: string,
  expectedTask?: string,
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
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      path: `$.${issue.path.join(".")}`,
      expected:
        issue.code === "invalid_enum_value"
          ? "enum value"
          : issue.code === "invalid_type"
            ? String(issue.expected)
            : "valid field",
      actual: issue.code === "invalid_type" ? String(issue.received) : actualType(parsed),
      reason: issue.message,
    }));
    throw new SyntheticExpressionParseError(
      "SCHEMA_MISMATCH",
      "Synthetic expression envelope schema mismatch",
      issues,
    );
  }
  const envelope = result.data;
  if (expectedSpeakerRole && envelope.speakerRole !== expectedSpeakerRole)
    throw new SyntheticExpressionParseError(
      "SCHEMA_MISMATCH",
      "Synthetic expression speaker role mismatch",
      [
        {
          path: "$.speakerRole",
          expected: expectedSpeakerRole,
          actual: envelope.speakerRole,
          reason: "role mismatch",
        },
      ],
    );
  if (expectedTask && envelope.task !== expectedTask)
    throw new SyntheticExpressionParseError(
      "SCHEMA_MISMATCH",
      "Synthetic expression task mismatch",
      [{ path: "$.task", expected: expectedTask, actual: envelope.task, reason: "task mismatch" }],
    );
  return Object.freeze({
    ...envelope,
    claims: Object.freeze([...envelope.claims]),
    unknowns: Object.freeze([...envelope.unknowns]),
    terminology: Object.freeze({ ...envelope.terminology }),
    warnings: Object.freeze([...envelope.warnings]),
  });
}
