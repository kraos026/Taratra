import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readHermesMission } from "./hermes-mission-client";
const company = "11111111-1111-4111-8111-111111111111";
const run = "run_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const env = {
  OPTIVOS_HERMES_COMPANY_ID: company,
  OPTIVOS_HERMES_API_URL: "http://127.0.0.1:8642",
  OPTIVOS_HERMES_API_KEY: "secret",
};
describe("Hermes registered-run consultation", () => {
  it("reads one exact native run and exposes only validated state", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        object: "hermes.run",
        run_id: run,
        status: "completed",
        output: "private content",
        runtime: { api_key: "secret" },
      }),
    );
    const data = await readHermesMission(company, run, env, fetcher);
    expect(data).toMatchObject({ availability: "available", status: "completed" });
    expect(fetcher.mock.calls[0][0].href).toBe(`http://127.0.0.1:8642/v1/runs/${run}`);
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      method: "GET",
      cache: "no-store",
      redirect: "error",
    });
    expect(JSON.stringify(data)).not.toMatch(/secret|private content|run_/);
  });
  it("refuses invalid IDs and a company not linked to this runtime before fetching", async () => {
    const fetcher = vi.fn();
    expect((await readHermesMission(company, "../sessions", env, fetcher)).availability).toBe(
      "unavailable",
    );
    expect(
      (await readHermesMission("22222222-2222-4222-8222-222222222222", run, env, fetcher))
        .availability,
    ).toBe("unlinked");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects a different returned run, future unknown state and raw upstream error", async () => {
    for (const body of [
      { object: "hermes.run", run_id: "run_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", status: "completed" },
      { object: "hermes.run", run_id: run, status: "secret status" },
      { error: "secret" },
    ]) {
      expect(
        await readHermesMission(company, run, env, vi.fn().mockResolvedValue(Response.json(body))),
      ).toMatchObject({ availability: "unavailable", status: null });
    }
    expect(
      await readHermesMission(
        company,
        run,
        env,
        vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
      ),
    ).toMatchObject({ availability: "not_found", status: null });
  });
});
