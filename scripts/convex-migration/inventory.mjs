import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePrismaSchema, renderConvexSchema } from "./schema-contract.mjs";
import { format, resolveConfig } from "prettier";
const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const contract = parsePrismaSchema(readFileSync(join(root, "prisma/schema.prisma"), "utf8"));
const sqlFiles = readdirSync(join(root, "supabase/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const created = new Set();
let policies = 0;
for (const name of sqlFiles) {
  const text = readFileSync(join(root, "supabase/migrations", name), "utf8").replace(
    /--[^\r\n]*/g,
    "",
  );
  for (const match of text.matchAll(
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(\w+)\.)?(\w+)/gi,
  ))
    created.add(`${match[1] || "public"}.${match[2]}`);
  policies += [...text.matchAll(/create\s+policy\b/gi)].length;
}
const mapped = new Set(contract.models.map((model) => `${model.sqlSchema}.${model.table}`));
function sourceFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() && entry.name !== "generated"
      ? sourceFiles(join(dir, entry.name))
      : entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name)
        ? [join(dir, entry.name)]
        : [],
  );
}
const files = sourceFiles(join(root, "src"));
const references = (pattern) =>
  files
    .filter((path) => pattern.test(readFileSync(path, "utf8")))
    .map((path) => relative(root, path).replaceAll("\\", "/"));
const report = {
  version: 1,
  sourceSchemaSha256: contract.sourceSha256,
  models: contract.models.length,
  scalarFields: contract.models.reduce((sum, model) => sum + model.fields.length, 0),
  decimalFields: contract.models.flatMap((model) =>
    model.fields
      .filter((field) => field.type === "Decimal")
      .map((field) => `${model.name}.${field.name}`),
  ),
  sqlMigrationFiles: sqlFiles.length,
  historicalCreatePolicyStatements: policies,
  historicalSqlTablesNotMappedByPrisma: [...created].filter((name) => !mapped.has(name)).sort(),
  supabaseSourceReferences: references(/@supabase|SUPABASE|infrastructure\/supabase/),
  prismaSourceReferences: references(/\bPrisma\b|\bprisma\b/),
  databaseRead: false,
  modelCalls: 0,
};
if (process.argv.includes("--generate")) {
  mkdirSync(join(root, "convex"), { recursive: true });
  writeFileSync(
    join(root, "convex/modelSchema.ts"),
    await format(renderConvexSchema(contract), {
      ...(await resolveConfig(join(root, "convex/modelSchema.ts"))),
      parser: "typescript",
    }),
  );
}
const outputIndex = process.argv.indexOf("--report");
if (outputIndex !== -1) {
  const output = process.argv[outputIndex + 1];
  if (!output) throw new Error("Missing report path");
  writeFileSync(resolve(output), JSON.stringify(report, null, 2) + "\n");
}
console.log(
  JSON.stringify({
    models: report.models,
    scalarFields: report.scalarFields,
    decimalFields: report.decimalFields.length,
    sqlMigrationFiles: report.sqlMigrationFiles,
    policies: report.historicalCreatePolicyStatements,
    unmappedHistoricalTables: report.historicalSqlTablesNotMappedByPrisma,
    supabaseFiles: report.supabaseSourceReferences.length,
    prismaFiles: report.prismaSourceReferences.length,
    generated: process.argv.includes("--generate"),
  }),
);
