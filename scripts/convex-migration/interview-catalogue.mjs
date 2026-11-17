import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";
import { rows } from "./audit-catalogue.mjs";
export function parseInterviewCatalogue(source) {
  const match = source.match(
    /insert into public\.interview_questions\s*\(([^)]+)\)\s*values\s*([\s\S]*?);/i,
  );
  if (!match) throw new Error("Interview catalogue INSERT missing");
  const columns = match[1].split(",").map((value) => value.trim());
  const questions = rows(match[2]).map((values) => {
    if (values.length !== columns.length) throw new Error("Interview catalogue column mismatch");
    const row = Object.fromEntries(columns.map((column, index) => [column, values[index]]));
    const hex = createHash("sha256").update(`optivos-interview-v1:${row.code}`).digest("hex");
    const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
    return {
      id,
      code: row.code,
      domain: row.domain,
      prompt: row.prompt,
      answerType: row.answer_type,
      mandatory: row.mandatory,
      weight: String(row.weight),
      sequence: row.sequence,
      conditionJson: JSON.parse(row.condition_json),
      validationJson: JSON.parse(row.validation_json),
      optionsJson: JSON.parse(row.options_json),
    };
  });
  if (new Set(questions.map((question) => question.code)).size !== questions.length)
    throw new Error("Duplicate interview question code");
  return {
    sourceMigration: "20260726042817_add_adaptive_interview_engine.sql",
    sourceSha256: createHash("sha256").update(source).digest("hex"),
    questions,
  };
}
if (process.argv.includes("--generate-interview")) {
  const source = readFileSync(
    new URL(
      "../../supabase/migrations/20260726042817_add_adaptive_interview_engine.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const output = new URL("../../convex/interviewCatalogueData.ts", import.meta.url);
  const catalogue = parseInterviewCatalogue(source);
  writeFileSync(
    output,
    await format(
      `// Generated from the existing adaptive interview SQL catalogue.\nexport const interviewCatalogue=${JSON.stringify(catalogue)} as const;\n`,
      { ...(await resolveConfig(fileURLToPath(output))), parser: "typescript" },
    ),
  );
  console.log(JSON.stringify({ questions: catalogue.questions.length, generated: true }));
}
