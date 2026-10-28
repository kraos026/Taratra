import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, relative, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePrismaSchema } from "./schema-contract.mjs";
import { transformSnapshot } from "./transform.mjs";

const [source, destination, ...extra] = process.argv.slice(2);
if (!source || !destination || extra.length)
  throw new Error(
    "Usage: node scripts/convex-migration/prepare-import.mjs PRIVATE_SNAPSHOT_JSON NEW_PRIVATE_OUTPUT_DIRECTORY",
  );
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = resolve(destination);
const fromRoot = relative(root, output);
if (!fromRoot || (!fromRoot.startsWith("..") && !isAbsolute(fromRoot)))
  throw new Error("Output must be outside the repository");
const contract = parsePrismaSchema(readFileSync(join(root, "prisma/schema.prisma"), "utf8"));
const snapshot = JSON.parse(readFileSync(resolve(source), "utf8"));
const result = transformSnapshot(contract, snapshot);
// Existing destinations are rejected. No remote import, destructive flags or credentials.
mkdirSync(output, { recursive: false, mode: 0o700 });
for (const [table, rows] of Object.entries(result.tables))
  writeFileSync(
    join(output, `${table}.jsonl`),
    rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""),
    { flag: "wx", mode: 0o600 },
  );
writeFileSync(join(output, "manifest.json"), JSON.stringify(result.manifest, null, 2) + "\n", {
  flag: "wx",
  mode: 0o600,
});
console.log(
  JSON.stringify({
    prepared: true,
    tables: result.manifest.summaries.length,
    rows: result.manifest.summaries.reduce((count, table) => count + table.rows, 0),
    imported: false,
    accountsAndFilesMigrated: false,
  }),
);
