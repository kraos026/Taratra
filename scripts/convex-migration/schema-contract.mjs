import { createHash } from "node:crypto";
const scalarTypes = new Set([
  "String",
  "Boolean",
  "Int",
  "Float",
  "Decimal",
  "DateTime",
  "Json",
  "BigInt",
  "Bytes",
]);
const identifier = /^[A-Za-z][A-Za-z0-9_]*$/;
function fieldsFromList(value) {
  return value
    .split(",")
    .map((item) => item.trim().match(/^(\w+)/)?.[1])
    .filter(Boolean);
}
export function parsePrismaSchema(source) {
  const blocks = [...source.matchAll(/^(model|enum)\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];
  if (!blocks.length) throw new Error("No Prisma models found");
  const enums = Object.fromEntries(
    blocks
      .filter((b) => b[1] === "enum")
      .map((b) => [
        b[2],
        b[3]
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("//") && !l.startsWith("@@"))
          .map((l) => l.match(/^(\w+)/)?.[1]),
      ]),
  );
  const modelNames = new Set(blocks.filter((b) => b[1] === "model").map((b) => b[2]));
  const models = blocks
    .filter((b) => b[1] === "model")
    .map((block) => {
      const [, , name, body] = block;
      const table = body.match(/@@map\("([^"]+)"\)/)?.[1] || name;
      const sqlSchema = body.match(/@@schema\("([^"]+)"\)/)?.[1] || "public";
      if (!identifier.test(table) || !identifier.test(sqlSchema))
        throw new Error(`Unsupported SQL identifier: ${name}`);
      const fields = [],
        relations = [],
        indexes = [];
      let primaryKey = [];
      for (const raw of body.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("//")) continue;
        if (line.startsWith("@@")) {
          const index = line.match(/^@@(id|unique|index)\(\[([^\]]+)\]/);
          if (index) {
            const names = fieldsFromList(index[2]);
            indexes.push({ fields: names, unique: index[1] !== "index" });
            if (index[1] === "id") primaryKey = names;
          } else if (!/^@@(map|schema)\(/.test(line))
            throw new Error(`Unsupported Prisma directive in ${name}`);
          continue;
        }
        const field = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/);
        if (!field) throw new Error(`Unsupported Prisma field declaration in ${name}`);
        const [, fieldName, type, array, nullable, attributes] = field;
        if (modelNames.has(type)) {
          relations.push({
            name: fieldName,
            targetModel: type,
            fields: fieldsFromList(attributes.match(/fields:\s*\[([^\]]+)\]/)?.[1] || ""),
            references: fieldsFromList(attributes.match(/references:\s*\[([^\]]+)\]/)?.[1] || ""),
          });
          continue;
        }
        if (!scalarTypes.has(type) && !enums[type])
          throw new Error(`Unsupported scalar type in ${name}.${fieldName}`);
        const column = attributes.match(/@map\("([^"]+)"\)/)?.[1] || fieldName;
        if (!identifier.test(column)) throw new Error(`Unsupported column name in ${name}`);
        fields.push({
          name: fieldName,
          column,
          type,
          array: !!array,
          nullable: !!nullable,
          uuid: /@db\.Uuid\b/.test(attributes),
          enumValues: enums[type] || null,
        });
        if (/(?:^|\s)@id\b/.test(attributes)) {
          primaryKey = [fieldName];
          indexes.push({ fields: [fieldName], unique: true });
        }
        if (/(?:^|\s)@unique\b/.test(attributes))
          indexes.push({ fields: [fieldName], unique: true });
      }
      if (!primaryKey.length) throw new Error(`Missing primary key in ${name}`);
      if (fields.some((field) => field.name === "legacyKey"))
        throw new Error(`Reserved migration field in ${name}`);
      if (fields.some((field) => field.name === "organizationId"))
        indexes.push({ fields: ["organizationId"], unique: false });
      if (
        fields.some((field) => field.name === "organizationId") &&
        fields.some((field) => field.name === "companyId")
      )
        indexes.push({ fields: ["organizationId", "companyId"], unique: false });
      if (
        fields.some((field) => field.name === "organizationId") &&
        fields.some((field) => field.name === "interviewSessionId")
      )
        indexes.push({ fields: ["organizationId", "interviewSessionId"], unique: false });
      const indexMap = new Map();
      for (const index of indexes) {
        const key = JSON.stringify(index.fields),
          previous = indexMap.get(key);
        indexMap.set(key, { ...index, unique: index.unique || previous?.unique || false });
      }
      const distinct = [...indexMap.values()];
      if (distinct.length + 1 > 32) throw new Error(`Too many indexes for ${name}`);
      return { name, table, sqlSchema, fields, relations, primaryKey, indexes: distinct };
    });
  if (new Set(models.map((m) => m.table)).size !== models.length)
    throw new Error("Colliding SQL table names need explicit target mapping");
  return {
    version: 1,
    sourceSha256: createHash("sha256").update(source).digest("hex"),
    enums,
    models,
  };
}
function validator(field) {
  let value = field.enumValues
    ? `v.union(${field.enumValues.map((value) => `v.literal(${JSON.stringify(value)})`).join(", ")})`
    : {
        String: "v.string()",
        Boolean: "v.boolean()",
        Int: "v.number()",
        Float: "v.number()",
        Decimal: "v.string()",
        DateTime: "v.string()",
        Json: "v.any()",
        BigInt: "v.string()",
        Bytes: "v.string()",
      }[field.type];
  if (field.array) value = `v.array(${value})`;
  if (field.nullable) value = `v.union(${value}, v.null())`;
  return value;
}
export function renderConvexSchema(contract) {
  const tables = contract.models.map((model) => {
    const columns = [
      "legacyKey: v.string(),",
      ...model.fields.map((field) => `${field.name}: ${validator(field)},`),
    ];
    const indexes = [
      { name: "by_legacy_key", fields: ["legacyKey"] },
      ...model.indexes.map((index) => ({
        name:
          index.fields.length === 1 && index.fields[0] === "id"
            ? "by_business_id"
            : `by_${index.fields.join("_")}`,
        fields: index.fields,
      })),
    ];
    return `${model.table}: defineTable({\n${columns.join("\n")}\n})${indexes.map((index) => `.index(${JSON.stringify(index.name)}, ${JSON.stringify(index.fields)})`).join("")},`;
  });
  return `// Generated by scripts/convex-migration/inventory.mjs. Do not edit by hand.\n// Source schema SHA-256: ${contract.sourceSha256}\n// Decimal/BigInt/Bytes retain exact text encodings; Json preserves the source's JSON contract.\nimport { defineTable } from "convex/server";\nimport { v } from "convex/values";\nexport const businessTables = {\n${tables.join("\n")}\n};\n`;
}
