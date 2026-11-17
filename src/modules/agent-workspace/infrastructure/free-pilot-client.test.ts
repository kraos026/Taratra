import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { callFreePilot } from "./free-pilot-client";
const id = "11111111-1111-4111-8111-111111111111";
const env = {
  OPTIVOS_HERMES_WORKSPACE_ID: id,
  OPTIVOS_HERMES_API_URL: "https://pilot.test",
  OPTIVOS_HERMES_PILOT_KEY: "server-only-key",
};
describe("free pilot transport boundary", () => {
  it("refuses an unbound workspace, ambiguous bindings and unsafe origin before network", async () => {
    const fetcher = vi.fn();
    for (const config of [
      {},
      { ...env, OPTIVOS_HERMES_WORKSPACE_ID: "other" },
      { ...env, OPTIVOS_HERMES_COMPANY_ID: id },
      { ...env, OPTIVOS_HERMES_API_URL: "http://pilot.test" },
      { ...env, OPTIVOS_HERMES_API_URL: "https://user:password@pilot.test" },
      { ...env, OPTIVOS_HERMES_API_URL: "https://pilot.test/path" },
    ])
      await expect(
        callFreePilot(id, "/pilot/missions", undefined, config, fetcher),
      ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("forbids global sessions, native mutations, query and mismatched methods", async () => {
    const fetcher = vi.fn();
    for (const [path, body] of [
      ["/api/sessions", undefined],
      ["/v1/runs", {}],
      ["/pilot/missions?all=1", undefined],
      ["/pilot/readiness", {}],
      [`/pilot/missions/${id}/stop`, undefined],
    ] as const)
      await expect(callFreePilot(id, path, body, env, fetcher)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("uses a dedicated server credential, bounded nonredirecting requests and no automatic replay", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ items: [], hasMore: false }));
    await callFreePilot(id, "/pilot/missions", undefined, env, fetcher);
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      method: "GET",
      redirect: "error",
      cache: "no-store",
      headers: { Authorization: "Bearer server-only-key" },
    });
    const rejecting = vi.fn().mockRejectedValue(new Error("network"));
    await expect(
      callFreePilot(id, "/pilot/missions", { id, prompt: "A real text mission" }, env, rejecting),
    ).rejects.toThrow();
    expect(rejecting).toHaveBeenCalledTimes(1);
  });
});
