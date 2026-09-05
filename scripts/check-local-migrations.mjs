import "./certification-db-guard.mjs";
import { readdirSync } from "node:fs";
import pg from "pg";
import { compareMigrationHistory } from "./migration-history.mjs";

// Guarded local connection only. History verification never applies migrations.
const db = new pg.Client({
  connectionString: process.env.DIRECT_URL,
  connectionTimeoutMillis: 5000,
});
try {
  await db.connect();
  await db.query("BEGIN READ ONLY");
  const { rows } = await db.query(
    "SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version",
  );
  const result = compareMigrationHistory(
    readdirSync(new URL("../supabase/migrations/", import.meta.url)),
    rows,
  );
  await db.query("ROLLBACK");
  console.log("SUPABASE MIGRATION HISTORY:", JSON.stringify(result));
  if (!result.matches) process.exitCode = 1;
} catch (error) {
  // pg error messages can include connection details. Expose only the stable code.
  console.error(
    "SUPABASE MIGRATION HISTORY: FAIL",
    typeof error?.code === "string" ? error.code : "CHECK_FAILED",
  );
  process.exitCode = 1;
} finally {
  await db.end();
}
