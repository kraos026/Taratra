const required = [
  "AUTOMATEX_E2E_BASE_URL",
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
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

console.log("CERTIFICATION ENVIRONMENT CONFIGURED");
console.log(`Base URL: ${process.env.AUTOMATEX_E2E_BASE_URL}`);
