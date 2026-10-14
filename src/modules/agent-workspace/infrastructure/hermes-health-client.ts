import "server-only";

import { z } from "zod";
import { companyIdSchema } from "@/modules/companies/application/company-schemas";
import type { HermesConnection } from "../domain/hermes-connection";

const healthSchema = z.object({
  object: z.literal("hermes.api_server.capabilities"),
  platform: z.literal("hermes-agent"),
  features: z.object({ run_status: z.boolean(), run_events_sse: z.boolean() }),
});

/** Adapted from HermesPilotClient: only native GET /v1/capabilities, never inference or global sessions. */
export async function readHermesConnection(
  companyId: string,
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
  const owner = companyIdSchema.safeParse(env.OPTIVOS_HERMES_COMPANY_ID);
  if (!owner.success) return result("unconfigured");
  if (owner.data !== companyId) return result("unlinked");
  if (!env.OPTIVOS_HERMES_API_KEY || !env.OPTIVOS_HERMES_API_URL) return result("unconfigured");
  let url: URL;
  try {
    url = new URL(env.OPTIVOS_HERMES_API_URL);
  } catch {
    return result("unconfigured");
  }
  try {
    // Only trusted deployment configuration selects the destination; request input cannot alter it.
    const loopback = ["127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/" ||
      !(url.protocol === "https:" || (url.protocol === "http:" && loopback))
    )
      return result("unconfigured");
    const response = await fetcher(new URL("/v1/capabilities", url), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.OPTIVOS_HERMES_API_KEY}`,
        Accept: "application/json",
      },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok || !response.body) return result("unavailable");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 16_384) {
          await reader.cancel();
          return result("unavailable");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const data = healthSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    if (!data.success) return result("unavailable");
    return result("connected", data.data.features.run_status, data.data.features.run_events_sse);
  } catch {
    return result("unavailable");
  }
}
