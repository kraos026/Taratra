import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { Client } from "pg";

type Target = "STAGING" | "PRODUCTION" | "UNKNOWN" | "MISSING";

const STAGING_REF = "ajvncwsazrhqjlktzojm";
const PRODUCTION_REF = "mekihopfrfmqnhmtktgr";
const STAGING_FINGERPRINT = "8B91A8C74DAFDA312A5E749FB2FCF0D86C457EC1BD131FEC623FCF40415211FA";
const PRODUCTION_FINGERPRINT = "9D97545E241E5A182D87437024040AC0952D1DEE0BE2811A5FD4D1C6D41456B9";

function uriTarget(value: string | undefined): Target {
  if (!value?.trim()) return "MISSING";

  try {
    const url = new URL(value);
    const identity =
      `${decodeURIComponent(url.hostname)} ${decodeURIComponent(url.username)}`.toLowerCase();
    if (identity.includes(STAGING_REF)) return "STAGING";
    if (identity.includes(PRODUCTION_REF)) return "PRODUCTION";
  } catch {
    return "UNKNOWN";
  }

  return "UNKNOWN";
}

function normalizeAddress(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\/\d+$/, "");
}

async function databaseTarget(value: string | undefined, uri: Target): Promise<Target> {
  if (uri === "STAGING" || uri === "PRODUCTION" || uri === "MISSING") return uri;
  if (!value?.trim()) return "MISSING";

  const client = new Client({
    connectionString: value,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const result = await client.query("SELECT inet_server_addr()::text AS server_addr;");
    const fingerprint = createHash("sha256")
      .update(normalizeAddress(result.rows[0]?.server_addr))
      .digest("hex")
      .toUpperCase();

    if (fingerprint === STAGING_FINGERPRINT) return "STAGING";
    if (fingerprint === PRODUCTION_FINGERPRINT) return "PRODUCTION";
    return "UNKNOWN";
  } catch {
    return "UNKNOWN";
  } finally {
    await client.end().catch(() => undefined);
  }
}

function overallTarget(databaseUrl: Target, directUrl: Target, publicUrl: Target): string {
  const targets = [databaseUrl, directUrl, publicUrl];
  if (targets.every((target) => target === "STAGING")) return "PREVIEW_ENV_STAGING_COHERENT";
  if (targets.every((target) => target === "PRODUCTION")) return "PREVIEW_ENV_PRODUCTION";
  if (targets.includes("STAGING") && targets.includes("PRODUCTION")) return "PREVIEW_ENV_MIXED";
  return "PREVIEW_ENV_UNKNOWN";
}

export async function GET() {
  const databaseUri = uriTarget(process.env.DATABASE_URL);
  const directUri = uriTarget(process.env.DIRECT_URL);
  const publicTarget = uriTarget(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const databaseTargetValue = await databaseTarget(process.env.DATABASE_URL, databaseUri);
  const directTargetValue = await databaseTarget(process.env.DIRECT_URL, directUri);

  return NextResponse.json({
    databaseUrl: databaseTargetValue,
    directUrl: directTargetValue,
    publicSupabaseUrl: publicTarget,
    overall: overallTarget(databaseTargetValue, directTargetValue, publicTarget),
  });
}
