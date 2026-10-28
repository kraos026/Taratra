import "server-only";

import { z } from "zod";
import { readHermesJson } from "./hermes-json-client";
import type { HermesConnection } from "../domain/hermes-connection";
import type { HermesRuntimeScope } from "../domain/hermes-runtime-scope";

const healthSchema = z.object({
  object: z.literal("hermes.api_server.capabilities"),
  platform: z.literal("hermes-agent"),
  features: z.object({ run_status: z.boolean(), run_events_sse: z.boolean() }),
});

/** Adapted from HermesPilotClient: only native GET /v1/capabilities, never inference or global sessions. */
export async function readHermesConnection(
  scope: HermesRuntimeScope,
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
): Promise<HermesConnection> {
  const result = (
    state: HermesConnection["state"],
    status = false,
    events = false,
  ): HermesConnection => ({
    state,
    checkedAt: new Date().toISOString(),
    monitoring: { status, events },
    liveExecution: false,
    modelCalls: 0,
  });
  const response = await readHermesJson(scope, "/v1/capabilities", env, fetcher);
  if (response.state !== "available")
    return result(response.state === "not_found" ? "unavailable" : response.state);
  const data = healthSchema.safeParse(response.data);
  if (!data.success) return result("unavailable");
  return result("connected", data.data.features.run_status, data.data.features.run_events_sse);
}
