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

console.log("CERTIFICATION DB GUARD: explicit non-production certification flag present.");
