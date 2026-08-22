const required = [
  "AUTOMATEX_E2E_BASE_URL",
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_PROJECT_REF",
  "E2E_USER_A_EMAIL",
  "E2E_USER_A_PASSWORD",
  "E2E_USER_B_EMAIL",
  "E2E_USER_B_PASSWORD",
];

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error("CERTIFICATION ENVIRONMENT NOT CONFIGURED");
  console.error(`Missing variable names: ${missing.join(", ")}`);
  process.exit(2);
}

if (process.env.AUTOMATEX_CERTIFICATION_TARGET !== "local") {
  console.error("CERTIFICATION ENVIRONMENT REJECTED");
  console.error("Only local certification target is allowed by this runner.");
  process.exit(2);
}

const errors = [];
assertLocalPostgres(process.env.DATABASE_URL, "DATABASE_URL", errors);
assertLocalPostgres(process.env.DIRECT_URL, "DIRECT_URL", errors);
assertLocalSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL, errors);
if (process.env.AUTOMATEX_E2E_BASE_URL !== "http://localhost:3000") {
  errors.push("AUTOMATEX_E2E_BASE_URL must be http://localhost:3000");
}
if (process.env.SUPABASE_PROJECT_REF !== "local") {
  errors.push("SUPABASE_PROJECT_REF must be local");
}
if (errors.length > 0) {
  console.error("LOCAL CERTIFICATION ENVIRONMENT REJECTED");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(2);
}

console.log("CERTIFICATION ENVIRONMENT CONFIGURED");
console.log(`Base URL: ${process.env.AUTOMATEX_E2E_BASE_URL}`);

function assertLocalPostgres(value, name, errors) {
  try {
    const url = new URL(value);
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "55022") {
      errors.push(`${name} must target local Postgres 127.0.0.1:55022`);
    }
  } catch {
    errors.push(`${name} must be a valid PostgreSQL URL`);
  }
}

function assertLocalSupabase(value, errors) {
  try {
    const url = new URL(value);
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "55021") {
      errors.push("NEXT_PUBLIC_SUPABASE_URL must target local Supabase 127.0.0.1:55021");
    }
  } catch {
    errors.push("NEXT_PUBLIC_SUPABASE_URL must be a valid URL");
  }
}
