import { createHash } from "node:crypto";
import { Client } from "pg";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
type Target = "STAGING" | "PRODUCTION" | "UNKNOWN" | "MISSING";
const refs = { STAGING: "ajvncwsazrhqjlktzojm", PRODUCTION: "mekihopfrfmqnhmtktgr" } as const;
// Previously recorded server-address fingerprints; changes fail closed as UNKNOWN.
const fingerprints = {
  STAGING: "8B91A8C74DAFDA312A5E749FB2FCF0D86C457EC1BD131FEC623FCF40415211FA",
  PRODUCTION: "9D97545E241E5A182D87437024040AC0952D1DEE0BE2811A5FD4D1C6D41456B9",
};
function uriTarget(value: string | undefined): Target {
  if (!value?.trim()) return "MISSING";
  try {
    const url = new URL(value);
    for (const target of ["STAGING", "PRODUCTION"] as const) {
      const ref = refs[target];
      if (
        url.hostname === `${ref}.supabase.co` ||
        url.hostname === `db.${ref}.supabase.co` ||
        decodeURIComponent(url.username) === `postgres.${ref}`
      )
        return target;
    }
  } catch {
    /* Never return raw environment values. */
  }
  return "UNKNOWN";
}
async function databaseTarget(value: string | undefined): Promise<Target> {
  const known = uriTarget(value);
  if (known !== "UNKNOWN") return known;
  let client: Client | undefined;
  try {
    const url = new URL(value!);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) return "UNKNOWN";
    // Do not inherit connection-string options that could disable certificate verification.
    url.searchParams.delete("sslmode");
    url.searchParams.delete("sslcert");
    url.searchParams.delete("sslkey");
    url.searchParams.delete("sslrootcert");
    client = new Client({
      connectionString: url.href,
      ssl: { rejectUnauthorized: true },
      connectionTimeoutMillis: 5000,
      query_timeout: 5000,
    });
    await client.connect();
    await client.query("BEGIN READ ONLY");
    const result = await client.query("SELECT inet_server_addr()::text AS server_addr");
    await client.query("ROLLBACK");
    const address = String(result.rows[0]?.server_addr ?? "")
      .trim()
      .toLowerCase()
      .replace(/\/\d+$/, "");
    const hash = createHash("sha256").update(address).digest("hex").toUpperCase();
    for (const target of ["STAGING", "PRODUCTION"] as const)
      if (hash === fingerprints[target]) return target;
  } catch {
    /* Unknown target / TLS / connection failure is not a staging proof. */
  } finally {
    await client?.end().catch(() => undefined);
  }
  return "UNKNOWN";
}
export async function GET() {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.VERCEL_GIT_COMMIT_REF !== "astra/optivos-finalization-20260914"
  )
    return new NextResponse(null, { status: 404 });
  const databaseUrl = await databaseTarget(process.env.DATABASE_URL);
  const directUrl = await databaseTarget(process.env.DIRECT_URL);
  const publicSupabaseUrl = uriTarget(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const targets = [databaseUrl, directUrl, publicSupabaseUrl];
  const overall = targets.every((t) => t === "STAGING")
    ? "PREVIEW_ENV_STAGING_COHERENT"
    : targets.every((t) => t === "PRODUCTION")
      ? "PREVIEW_ENV_PRODUCTION"
      : targets.includes("STAGING") && targets.includes("PRODUCTION")
        ? "PREVIEW_ENV_MIXED"
        : "PREVIEW_ENV_UNKNOWN";
  return NextResponse.json(
    {
      environment: "preview",
      sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      databaseUrl,
      directUrl,
      publicSupabaseUrl,
      overall,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
