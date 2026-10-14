import "server-only";
import { companyIdSchema } from "@/modules/companies/application/company-schemas";

type Result =
  | { state: "available"; data: unknown }
  | { state: "unconfigured" | "unlinked" | "unavailable" | "not_found" };
/** Trusted configuration and fixed native GET paths; keys and raw responses stay on the server. */
export async function readHermesJson(
  companyId: string,
  path: string,
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
): Promise<Result> {
  if (!/^\/(?:v1\/capabilities|v1\/runs\/run_[0-9a-f]{32})$/.test(path))
    return { state: "unavailable" };
  const owner = companyIdSchema.safeParse(env.OPTIVOS_HERMES_COMPANY_ID);
  if (!owner.success) return { state: "unconfigured" };
  if (owner.data !== companyId) return { state: "unlinked" };
  if (!env.OPTIVOS_HERMES_API_KEY || !env.OPTIVOS_HERMES_API_URL) return { state: "unconfigured" };
  let url: URL;
  try {
    url = new URL(env.OPTIVOS_HERMES_API_URL);
  } catch {
    return { state: "unconfigured" };
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" && ["127.0.0.1", "[::1]"].includes(url.hostname))
    )
  )
    return { state: "unconfigured" };
  try {
    const response = await fetcher(new URL(path, url), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.OPTIVOS_HERMES_API_KEY}`,
        Accept: "application/json",
      },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (response.status === 404) return { state: "not_found" };
    if (!response.ok || !response.body) return { state: "unavailable" };
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
          return { state: "unavailable" };
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
    return { state: "available", data: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { state: "unavailable" };
  }
}
