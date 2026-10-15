import "server-only";
import { z } from "zod";

export async function callFreePilot(
  workspaceId: string,
  path: string,
  body?: unknown,
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
) {
  if (
    !z.string().uuid().safeParse(workspaceId).success ||
    env.OPTIVOS_HERMES_WORKSPACE_ID !== workspaceId ||
    env.OPTIVOS_HERMES_COMPANY_ID ||
    !env.OPTIVOS_HERMES_PILOT_KEY ||
    !env.OPTIVOS_HERMES_API_URL
  )
    throw new Error("Pilot not configured");
  const allowed =
    body === undefined
      ? /^\/pilot\/(?:readiness|missions|missions\/[0-9a-f-]{36})$/
      : /^\/pilot\/(?:missions|missions\/[0-9a-f-]{36}\/stop)$/;
  if (!allowed.test(path)) throw new Error("Pilot path refused");
  const origin = new URL(env.OPTIVOS_HERMES_API_URL);
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error("Pilot origin refused");
  const response = await fetcher(new URL(path, origin), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${env.OPTIVOS_HERMES_PILOT_KEY}`,
      "X-Optivos-Workspace-Id": workspaceId,
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.body) throw new Error("Pilot response unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2_097_152) {
        await reader.cancel();
        throw new Error("Pilot response exceeds limit");
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
  return { status: response.status, data: JSON.parse(new TextDecoder().decode(bytes)) as unknown };
}
