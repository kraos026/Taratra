import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readHermesInventory } from "./hermes-inventory-client";
import { hermesInventorySchema } from "../domain/hermes-inventory";
import { readHermesJson } from "./hermes-json-client";

const id = "11111111-1111-4111-8111-111111111111";
const env = {
  OPTIVOS_HERMES_COMPANY_ID: id,
  OPTIVOS_HERMES_API_URL: "http://127.0.0.1:8642",
  OPTIVOS_HERMES_API_KEY: "private-key",
};
const skills = {
  object: "list",
  data: [
    {
      name: "research",
      description: "Search sources",
      instructions: "private instructions",
      apiKey: "private-key",
    },
  ],
};
const toolsets = {
  object: "list",
  data: [
    {
      name: "web",
      label: "Web",
      enabled: true,
      configured: false,
      tools: [{ secret: "private-key" }],
      env: "private environment",
    },
  ],
};
describe("Hermes inventory read boundary", () => {
  it("does not request an unconfigured or foreign company server", async () => {
    const fetcher = vi.fn();
    expect((await readHermesInventory(id, {}, fetcher)).skills.state).toBe("unconfigured");
    const foreign = await readHermesInventory("22222222-2222-4222-8222-222222222222", env, fetcher);
    expect(foreign.skills).toEqual({ state: "unlinked", items: [] });
    expect(foreign.toolsets).toEqual({ state: "unlinked", items: [] });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("requests only two bounded native GETs and removes private fields", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation((url: URL) =>
        Promise.resolve(Response.json(url.pathname === "/v1/skills" ? skills : toolsets)),
      );
    const value = await readHermesInventory(id, env, fetcher);
    expect(hermesInventorySchema.safeParse(value).success).toBe(true);
    expect(value.skills).toMatchObject({ state: "available", items: [{ name: "research" }] });
    expect(value.toolsets).toMatchObject({
      state: "available",
      items: [{ enabled: true, configured: false }],
    });
    expect(value.modelCalls).toBe(0);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.map(([url]) => url.pathname).sort()).toEqual([
      "/v1/skills",
      "/v1/toolsets",
    ]);
    for (const [, options] of fetcher.mock.calls)
      expect(options).toMatchObject({ method: "GET", redirect: "error", cache: "no-store" });
    expect(JSON.stringify(value)).not.toMatch(
      /private-key|instructions|private environment|secret/,
    );
    expect(await readHermesJson(id, "/api/sessions", env, fetcher)).toEqual({
      state: "unavailable",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("preserves an available list when the other fails without claiming an empty successful list", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation((url: URL) =>
        Promise.resolve(
          url.pathname === "/v1/skills"
            ? Response.json(skills)
            : new Response("private-key", { status: 503 }),
        ),
      );
    const value = await readHermesInventory(id, env, fetcher);
    expect(value.skills.state).toBe("available");
    expect(value.toolsets).toEqual({ state: "unavailable", items: [] });
  });
  it("rejects malformed, oversized and excessive lists", async () => {
    for (const body of [
      { object: "list", data: [{ name: "web", enabled: "true" }] },
      { object: "list", data: Array.from({ length: 101 }, () => ({ name: "web" })) },
      { object: "list", data: [{ name: "web", privateNotes: "x".repeat(65536) }] },
    ]) {
      const value = await readHermesInventory(
        id,
        env,
        vi.fn().mockImplementation(() => Promise.resolve(Response.json(body))),
      );
      expect(value.toolsets.state).toBe("unavailable");
    }
  });
});
