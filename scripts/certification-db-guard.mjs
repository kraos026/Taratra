if (process.env.AUTOMATEX_CERTIFICATION_DB !== "true") {
  console.error("CERTIFICATION DB GUARD: set AUTOMATEX_CERTIFICATION_DB=true explicitly.");
  process.exit(2);
}

for (const name of ["DATABASE_URL", "DIRECT_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
  if (!process.env[name]?.trim()) {
    console.error(`CERTIFICATION DB GUARD: missing ${name}`);
    process.exit(2);
  }
}

if (process.env.AUTOMATEX_CERTIFICATION_TARGET !== "local") {
  console.error("CERTIFICATION DB GUARD: only local certification target is allowed.");
  process.exit(2);
}

try {
  assertLocalPostgres(process.env.DATABASE_URL, "DATABASE_URL");
  assertLocalPostgres(process.env.DIRECT_URL, "DIRECT_URL");
  const supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!["127.0.0.1", "localhost"].includes(supabase.hostname) || supabase.port !== "55021") {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must target local Supabase");
  }
  if (process.env.SUPABASE_PROJECT_REF !== "local") {
    throw new Error("SUPABASE_PROJECT_REF must be local");
  }
} catch (error) {
  console.error(`CERTIFICATION DB GUARD: local target rejected (${error.message})`);
  process.exit(2);
}

console.log("CERTIFICATION DB GUARD: explicit non-production certification flag present.");

function assertLocalPostgres(value, name) {
  const url = new URL(value);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "55022") {
    throw new Error(`${name} must target local Postgres 127.0.0.1:55022`);
  }
}
