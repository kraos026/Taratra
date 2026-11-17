import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readHermesConnection } from "./hermes-health-client";
import { isHermesConnection } from "../domain/hermes-connection";

const id = "11111111-1111-4111-8111-111111111111";
const env = {
  OPTIVOS_HERMES_COMPANY_ID: id,
  OPTIVOS_HERMES_API_URL: "http://127.0.0.1:8642",
  OPTIVOS_HERMES_API_KEY: "private-api-secret",
};
const healthy = {
  object: "hermes.api_server.capabilities",
  platform: "hermes-agent",
  features: { run_status: true, run_events_sse: true },
  privateNotes: "private data",
  token: env.OPTIVOS_HERMES_API_KEY,
};

describe("Hermes read-only health boundary", () => {
  it("keeps the standalone workspace binding distinct from an audit dossier binding", async () => {
    const config = {
      ...env,
      OPTIVOS_HERMES_COMPANY_ID: undefined,
      OPTIVOS_HERMES_WORKSPACE_ID: id,
    };
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(Response.json(healthy)));
    expect((await readHermesConnection(id, config, fetcher)).state).toBe("unconfigured");
    expect(
      (
        await readHermesConnection(
          { workspaceId: "22222222-2222-4222-8222-222222222222" },
          config,
          fetcher,
        )
      ).state,
    ).toBe("unlinked");
    expect((await readHermesConnection({ workspaceId: id }, env, fetcher)).state).toBe(
      "unconfigured",
    );
    expect(
      (
        await readHermesConnection(
          { workspaceId: id },
          { ...env, OPTIVOS_HERMES_WORKSPACE_ID: id },
          fetcher,
        )
      ).state,
    ).toBe("unconfigured");
    expect(fetcher).not.toHaveBeenCalled();
    expect((await readHermesConnection({ workspaceId: id }, config, fetcher)).state).toBe(
      "connected",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not contact Hermes without explicit company binding and private configuration", async () => {
    const fetcher = vi.fn();
    for (const config of [
      {},
      { ...env, OPTIVOS_HERMES_COMPANY_ID: "invalid" },
      { ...env, OPTIVOS_HERMES_API_KEY: "" },
    ]) {
      expect((await readHermesConnection(id, config, fetcher)).state).toBe("unconfigured");
    }
    expect(
      (await readHermesConnection("22222222-2222-4222-8222-222222222222", env, fetcher)).state,
    ).toBe("unlinked");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("uses only authenticated GET /v1/capabilities with no redirects, caching or inference", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(healthy));
    const result = await readHermesConnection(id, env, fetcher);
    expect(result).toMatchObject({
      state: "connected",
      monitoring: { status: true, events: true },
      liveExecution: false,
      modelCalls: 0,
    });
    expect(isHermesConnection(result)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0].href).toBe("http://127.0.0.1:8642/v1/capabilities");
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      method: "GET",
      cache: "no-store",
      redirect: "error",
      headers: { Authorization: `Bearer ${env.OPTIVOS_HERMES_API_KEY}` },
    });
    expect(fetcher.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(JSON.stringify(result)).not.toMatch(
      /private-api-secret|privateNotes|private data|127\.0\.0\.1/,
    );
  });
  it("refuses unsafe or ambiguous deployment URLs without a request", async () => {
    const fetcher = vi.fn();
    for (const url of [
      "http://external.test",
      "ftp://localhost",
      "https://user:pass@hermes.test",
      "https://hermes.test/path",
      "https://hermes.test?run=1",
      "https://hermes.test#secret",
      "bad-url",
    ]) {
      expect(
        (await readHermesConnection(id, { ...env, OPTIVOS_HERMES_API_URL: url }, fetcher)).state,
      ).toBe("unconfigured");
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("projects unavailable and malformed responses without leaking raw errors or tokens", async () => {
    const responses = [
      new Response("private-api-secret", { status: 401 }),
      new Response("not JSON"),
      Response.json({ platform: "another-server" }),
      Response.json({ ...healthy, features: { run_status: "true" } }),
      new Response("x".repeat(16_385)),
    ];
    for (const response of responses) {
      const result = await readHermesConnection(id, env, vi.fn().mockResolvedValue(response));
      expect(result.state).toBe("unavailable");
      expect(JSON.stringify(result)).not.toContain("private-api-secret");
    }
    const result = await readHermesConnection(
      id,
      env,
      vi.fn().mockRejectedValue(new Error("private-api-secret")),
    );
    expect(result.state).toBe("unavailable");
  });
  it("accepts a trusted HTTPS origin and reports unavailable capabilities faithfully", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ ...healthy, features: { run_status: false, run_events_sse: false } }),
      );
    expect(
      await readHermesConnection(
        id,
        { ...env, OPTIVOS_HERMES_API_URL: "https://hermes.example" },
        fetcher,
      ),
    ).toMatchObject({ state: "connected", monitoring: { status: false, events: false } });
    expect(fetcher.mock.calls[0][0].href).toBe("https://hermes.example/v1/capabilities");
  });
  it("rejects malformed UI contracts and an accidental live execution response", async () => {
    for (const value of [
      null,
      {},
      { state: "toString", liveExecution: false, modelCalls: 0 },
      {
        state: "connected",
        checkedAt: "bad date",
        monitoring: { status: true, events: true },
        liveExecution: false,
        modelCalls: 0,
      },
      {
        state: "connected",
        checkedAt: new Date().toISOString(),
        liveExecution: true,
        modelCalls: 0,
      },
    ])
      expect(isHermesConnection(value)).toBe(false);
  });
});
