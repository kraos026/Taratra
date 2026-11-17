import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { format, resolveConfig } from "prettier";
import { fileURLToPath } from "node:url";

export function rows(text) {
  const result = [];
  let row = [],
    token = "",
    quoted = false,
    wasQuoted = false,
    depth = 0;
  function field() {
    const value = token.trim();
    if (wasQuoted) row.push(token);
    else if (value === "null") row.push(null);
    else if (value === "true" || value === "false") row.push(value === "true");
    else if (/^-?\d+$/.test(value)) row.push(Number(value));
    else throw new Error("Unsupported catalogue SQL expression");
    token = "";
    wasQuoted = false;
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === "'" && text[i + 1] === "'") {
        token += "'";
        i++;
      } else if (char === "'") quoted = false;
      else token += char;
    } else if (char === "'") {
      quoted = true;
      wasQuoted = true;
      token = "";
    } else if (char === "(") {
      if (depth++) throw new Error("Nested catalogue SQL expression");
    } else if (char === ")") {
      field();
      result.push(row);
      row = [];
      depth--;
    } else if (char === ",") {
      if (depth) field();
    } else if (depth && (!wasQuoted || !/\s/.test(char))) token += char;
    else if (!/\s/.test(char)) throw new Error("Unexpected catalogue SQL token");
  }
  if (depth || quoted) throw new Error("Incomplete catalogue SQL");
  return result;
}
function questionId(code) {
  const bytes = createHash("sha256")
    .update(`optivos-catalogue-v1:${code}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function parseAuditCatalogue(source) {
  const tables = {};
  for (const match of source.matchAll(
    /insert into public\.(questionnaire_\w+)\s*\(([^)]+)\)\s*values\s*([\s\S]*?);/gi,
  )) {
    const columns = match[2].split(",").map((value) => value.trim());
    if (tables[match[1]]) throw new Error("Repeated catalogue INSERT");
    tables[match[1]] = rows(match[3]).map((values) => {
      if (values.length !== columns.length) throw new Error("Catalogue column count mismatch");
      return Object.fromEntries(columns.map((column, i) => [column, values[i]]));
    });
  }
  const [template] = tables.questionnaire_templates ?? [],
    [version] = tables.questionnaire_versions ?? [];
  if (
    Object.keys(tables).length !== 4 ||
    !template ||
    !version ||
    tables.questionnaire_templates.length !== 1 ||
    tables.questionnaire_versions.length !== 1 ||
    !source.includes(`where questionnaire_versions.id = '${version.id}'`)
  )
    throw new Error("Unsupported catalogue structure");
  const publication =
    /update public\.questionnaire_versions\s+set status = 'published', published_at = now\(\)/.test(
      source,
    );
  if (!publication) throw new Error("Catalogue publication must be explicit");
  if (version.questionnaire_template_id !== template.id || template.is_system !== true)
    throw new Error("Catalogue template lineage mismatch");
  const codes = new Set();
  const questions = tables.questionnaire_questions.map((row) => {
    if (codes.has(row.code)) throw new Error("Duplicate catalogue question code");
    codes.add(row.code);
    return {
      id: questionId(row.code),
      sectionId: row.questionnaire_section_id,
      code: row.code,
      label: row.label,
      questionType: row.question_type,
      required: row.required,
      position: row.position,
      optionsJson: row.options_json === null ? null : JSON.parse(row.options_json),
      validationJson: JSON.parse(row.validation_json),
    };
  });
  const sections = tables.questionnaire_sections.map((row) => ({
    id: row.id,
    versionId: row.questionnaire_version_id,
    title: row.title,
    position: row.position,
    questions: questions.filter((question) => question.sectionId === row.id),
  }));
  if (
    sections.some((section) => section.versionId !== version.id || !section.questions.length) ||
    questions.some((question) => !sections.some((section) => section.id === question.sectionId))
  )
    throw new Error("Catalogue lineage mismatch");
  return {
    sourceMigration: "20260722064705_add_audit_questionnaire.sql",
    sourceSha256: createHash("sha256").update(source).digest("hex"),
    template: {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      isSystem: template.is_system,
    },
    version: {
      id: version.id,
      templateId: version.questionnaire_template_id,
      versionNumber: version.version_number,
      status: "published",
    },
    sections,
  };
}

if (process.argv.includes("--generate")) {
  const source = readFileSync(
    new URL(
      "../../supabase/migrations/20260722064705_add_audit_questionnaire.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const output = new URL("../../convex/auditCatalogueData.ts", import.meta.url);
  const catalogue = parseAuditCatalogue(source);
  writeFileSync(
    output,
    await format(
      `// Generated from the canonical SQL seed. No customer data or answers.\nexport const auditCatalogue = ${JSON.stringify(catalogue)} as const;\n`,
      { ...(await resolveConfig(fileURLToPath(output))), parser: "typescript" },
    ),
  );
  console.log(
    JSON.stringify({
      sections: catalogue.sections.length,
      questions: catalogue.sections.reduce((count, section) => count + section.questions.length, 0),
      generated: true,
    }),
  );
}
