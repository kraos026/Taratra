const STAGING_REF = "ajvncwsazrhqjlktzojm";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parse(value: string | undefined, name: string): URL {
  try {
    if (!value) throw new Error();
    return new URL(value);
  } catch {
    // Never include the value: database URLs contain credentials.
    throw new Error(`PILOT TARGET REJECTED: invalid or missing ${name}`);
  }
}

/** Mutating pilot tests run only locally or against an explicitly selected staging Preview.
 * A vercel.app suffix is NOT evidence of a Preview. The release operator must inspect
 * deployment metadata and its environment before setting AUTOMATEX_E2E_PREVIEW_URL.
 */
export function assertPilotTarget(env: Readonly<Record<string, string | undefined>>): void {
  const app = parse(env.AUTOMATEX_E2E_BASE_URL, "AUTOMATEX_E2E_BASE_URL");
  const auth = parse(env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
  const db = parse(env.DATABASE_URL, "DATABASE_URL");
  const direct = env.DIRECT_URL ? parse(env.DIRECT_URL, "DIRECT_URL") : db;
  const postgres = [db, direct];
  if (app.username || app.password || app.pathname !== "/" || app.search || app.hash)
    throw new Error("PILOT TARGET REJECTED: base URL must be a plain origin");
  if (postgres.some((url) => !["postgres:", "postgresql:"].includes(url.protocol)))
    throw new Error("PILOT TARGET REJECTED: database protocol");

  if (LOCAL_HOSTS.has(app.hostname)) {
    if (
      !["http:", "https:"].includes(app.protocol) ||
      !LOCAL_HOSTS.has(auth.hostname) ||
      auth.port !== "55021" ||
      !["http:", "https:"].includes(auth.protocol) ||
      postgres.some((url) => !LOCAL_HOSTS.has(url.hostname) || url.port !== "55022")
    )
      throw new Error("PILOT TARGET REJECTED: local app requires local certification Auth and DB");
    return;
  }

  const approved = parse(env.AUTOMATEX_E2E_PREVIEW_URL, "AUTOMATEX_E2E_PREVIEW_URL");
  if (
    env.AUTOMATEX_E2E_TARGET !== "staging" ||
    app.protocol !== "https:" ||
    !app.hostname.endsWith(".vercel.app") ||
    approved.href !== app.href ||
    auth.origin !== `https://${STAGING_REF}.supabase.co` ||
    postgres.some((url) => {
      const directHost =
        url.hostname === `db.${STAGING_REF}.supabase.co` && url.username === "postgres";
      const pooler =
        /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) &&
        url.username === `postgres.${STAGING_REF}`;
      return (!directHost && !pooler) || !["5432", "6543"].includes(url.port);
    }) ||
    !env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim()
  )
    throw new Error(
      "PILOT TARGET REJECTED: explicit staging Preview, staging Auth/DB and protection credential required",
    );
}
