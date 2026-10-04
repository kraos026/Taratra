import { describe, expect, it, vi } from "vitest";
import { createKimiAuditExplanationSelector } from "./kimi-audit-explanation";

const env = {
  OPTIVOS_KIMI_EXPLANATIONS_ENABLED: "true",
  OPTIVOS_KIMI_API_KEY: "test-only-not-a-secret",
  OPTIVOS_KIMI_MODEL: "kimi-test",
};
function response(content: string, finish_reason = "stop", tool_calls?: unknown) {
  return new Response(
    JSON.stringify({
      choices: [{ finish_reason, message: { content, ...(tool_calls ? { tool_calls } : {}) } }],
    }),
  );
}
describe("bounded Kimi educational selector", () => {
  it("is disabled without explicit config and always disabled on Production", () => {
    const fetcher = vi.fn();
    expect(createKimiAuditExplanationSelector({}, "tenant", fetcher)).toBeUndefined();
    expect(
      createKimiAuditExplanationSelector({ ...env, VERCEL_ENV: "production" }, "tenant", fetcher),
    ).toBeUndefined();
    expect(
      createKimiAuditExplanationSelector({ ...env, OPTIVOS_KIMI_MODEL: "" }, "tenant", fetcher),
    ).toBeUndefined();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("sends only approved topic codes, never identifiers or business values", async () => {
    const fetcher = vi.fn().mockResolvedValue(response('{"topics":["ECONOMICS"]}'));
    const provider = createKimiAuditExplanationSelector(env, "private-tenant-test", fetcher)!;
    expect(await provider.select(["ECONOMICS"])).toEqual(["ECONOMICS"]);
    const [url, request] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://api.moonshot.ai/v1/chat/completions");
    expect(request.redirect).toBe("error");
    expect(request.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(request.body);
    expect(body.max_tokens).toBe(128);
    expect(body).not.toHaveProperty("tools");
    expect(request.body).not.toContain("private-tenant-test");
    expect(JSON.parse(body.messages[1].content)).toEqual({ allowedTopics: ["ECONOMICS"] });
  });
  it.each([
    '{"topics":["HUMAN_CONTROL"]}',
    '{"topics":["ECONOMICS","ECONOMICS"]}',
    '{"topics":["ECONOMICS"],"gain":99999}',
    '{"topics":["AUTOMATE_NOW"]}',
    "Guaranteed gains",
  ])("rejects unapproved, duplicate or invented output: %s", async (content) => {
    const provider = createKimiAuditExplanationSelector(
      env,
      `invalid-${content}`,
      vi.fn().mockResolvedValue(response(content)),
    )!;
    await expect(provider.select(["ECONOMICS"])).rejects.toThrow();
  });
  it("rejects incomplete completions and tool calls", async () => {
    for (const [id, value] of [
      ["cut", response('{"topics":["ECONOMICS"]}', "length")],
      ["tool", response('{"topics":["ECONOMICS"]}', "stop", [{}])],
    ] as const) {
      await expect(
        createKimiAuditExplanationSelector(env, id, vi.fn().mockResolvedValue(value))!.select([
          "ECONOMICS",
        ]),
      ).rejects.toThrow();
    }
  });
  it("bounds attempts per tenant and does not retry a failure", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("timeout"));
    const provider = createKimiAuditExplanationSelector(env, "budget-test", fetcher)!;
    for (let i = 0; i < 6; i++) await expect(provider.select(["EVIDENCE"])).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
});
