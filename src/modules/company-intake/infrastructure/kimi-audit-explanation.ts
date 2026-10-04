import { z } from "zod";
import type {
  AuditExplanationSelector,
  AuditExplanationTopic,
} from "../application/audit-explanation";

const selectionSchema = z
  .object({
    topics: z
      .array(z.enum(["EVIDENCE", "ECONOMICS", "HUMAN_CONTROL", "UNCERTAINTY"]))
      .min(1)
      .max(3),
  })
  .strict();
const budgets = new Map<string, { start: number; calls: number }>();

/** Server-only adapter. No tenant IDs, questions, figures or company text leave this boundary. */
export function createKimiAuditExplanationSelector(
  env: Readonly<Record<string, string | undefined>>,
  tenantId: string,
  fetcher: typeof fetch = fetch,
): AuditExplanationSelector | undefined {
  if (
    typeof window !== "undefined" ||
    env.VERCEL_ENV === "production" ||
    env.OPTIVOS_KIMI_EXPLANATIONS_ENABLED !== "true"
  )
    return undefined;
  const key = env.OPTIVOS_KIMI_API_KEY;
  const model = env.OPTIVOS_KIMI_MODEL;
  if (!key || !model || !/^kimi-[a-z0-9.-]{1,60}$/.test(model) || !tenantId) return undefined;
  return {
    async select(topics: readonly AuditExplanationTopic[]) {
      const now = Date.now();
      for (const [id, budget] of budgets) if (now - budget.start >= 3_600_000) budgets.delete(id);
      const budget = budgets.get(tenantId) ?? { start: now, calls: 0 };
      // Per warm process, not a distributed spending guarantee. Fail closed on capacity.
      if (budget.calls >= 5 || (!budgets.has(tenantId) && budgets.size >= 1000))
        throw new Error("Explanation budget unavailable");
      budget.calls += 1;
      budgets.set(tenantId, budget);
      const response = await fetcher("https://api.moonshot.ai/v1/chat/completions", {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(4000),
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          max_tokens: 128,
          stream: false,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                'Select up to three relevant educational topic IDs from the allowed list. Return only JSON {"topics":[...]}. Do not add text, claims, figures or tools.',
            },
            { role: "user", content: JSON.stringify({ allowedTopics: topics }) },
          ],
        }),
      });
      if (!response.ok) throw new Error("Explanation unavailable");
      const payload = (await response.json()) as {
        choices?: {
          finish_reason?: string;
          message?: { content?: unknown; tool_calls?: unknown };
        }[];
      };
      const choice = payload.choices?.[0];
      const content = choice?.message?.content;
      if (
        choice?.finish_reason !== "stop" ||
        choice.message?.tool_calls ||
        typeof content !== "string" ||
        content.length > 1000
      )
        throw new Error("Invalid explanation selection");
      const selected = selectionSchema.parse(JSON.parse(content)).topics;
      if (new Set(selected).size !== selected.length || selected.some((id) => !topics.includes(id)))
        throw new Error("Unapproved explanation topic");
      return selected;
    },
  };
}
