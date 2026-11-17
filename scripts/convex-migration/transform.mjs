import { createHash } from "node:crypto";

function fail(location, reason) {
  // Never put source values, personal data or credentials in validation errors.
  throw new Error(`${location}: ${reason}`);
}

function scalar(value, field, location) {
  if (value === null) {
    if (!field.nullable) fail(location, "required value is null");
    return null;
  }
  if (field.enumValues) {
    if (!field.enumValues.includes(value)) fail(location, "invalid enum");
    return value;
  }
  switch (field.type) {
    case "Decimal":
      if (typeof value !== "string" || !/^[+-]?\d+(?:\.\d+)?$/.test(value))
        fail(location, "decimal must be exact text");
      return value;
    case "BigInt":
      if (
        typeof value !== "string" ||
        !/^-?\d+$/.test(value) ||
        BigInt(value) < -(2n ** 63n) ||
        BigInt(value) >= 2n ** 63n
      )
        fail(location, "bigint must be signed 64-bit text");
      return value;
    case "String":
      if (typeof value !== "string") fail(location, "expected string");
      if (
        field.uuid &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
      )
        fail(location, "invalid UUID");
      // PostgreSQL uuid normalizes case before storage; preserve that comparison behavior.
      return field.uuid ? value.toLowerCase() : value;
    case "Boolean":
      if (typeof value !== "boolean") fail(location, "expected boolean");
      return value;
    case "Int":
      if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647)
        fail(location, "expected signed 32-bit integer");
      return value;
    case "Float":
      if (typeof value !== "number" || !Number.isFinite(value))
        fail(location, "expected finite number");
      return value;
    case "DateTime":
      if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
        !Number.isFinite(Date.parse(value))
      )
        fail(location, "expected timestamp with explicit timezone");
      // Do not round PostgreSQL microseconds through Date/toISOString.
      return value;
    case "Bytes":
      if (typeof value !== "string" || Buffer.from(value, "base64").toString("base64") !== value)
        fail(location, "expected canonical base64");
      return value;
    case "Json":
      return value;
    default:
      fail(location, "unsupported scalar");
  }
}

export function transformSnapshot(contract, snapshot) {
  if (
    snapshot?.version !== 1 ||
    !snapshot.tables ||
    typeof snapshot.tables !== "object" ||
    Array.isArray(snapshot.tables)
  )
    fail("snapshot", "unsupported bundle");
  const known = new Set(contract.models.map((model) => `${model.sqlSchema}.${model.table}`));
  for (const name of Object.keys(snapshot.tables))
    if (!known.has(name)) fail("snapshot", "unmapped table requires an explicit contract");
  const tables = {};
  const summaries = [];
  for (const model of contract.models) {
    const sourceName = `${model.sqlSchema}.${model.table}`;
    const rows = snapshot.tables[sourceName];
    if (!Array.isArray(rows)) fail(sourceName, "missing table, including empty tables");
    const columns = new Set(model.fields.map((field) => field.column));
    const uniqueSets = [
      model.primaryKey,
      ...model.indexes.filter((index) => index.unique).map((index) => index.fields),
    ];
    const seen = uniqueSets.map(() => new Set());
    const output = rows.map((row, rowIndex) => {
      const location = `${sourceName}[${rowIndex}]`;
      if (!row || typeof row !== "object" || Array.isArray(row))
        fail(location, "expected row object");
      if (Object.keys(row).some((column) => !columns.has(column)))
        fail(location, "unmapped source column");
      const target = {};
      for (const field of model.fields) {
        if (!Object.hasOwn(row, field.column)) fail(`${location}.${field.name}`, "missing column");
        const value = row[field.column];
        if (field.array && value !== null) {
          if (!Array.isArray(value)) fail(`${location}.${field.name}`, "expected array");
          target[field.name] = value.map((item) =>
            scalar(item, { ...field, array: false, nullable: false }, `${location}.${field.name}`),
          );
        } else target[field.name] = scalar(value, field, `${location}.${field.name}`);
      }
      target.legacyKey = JSON.stringify(model.primaryKey.map((key) => target[key]));
      uniqueSets.forEach((fields, index) => {
        if (fields.some((field) => target[field] === null)) return; // SQL unique constraints permit multiple nulls.
        const key = JSON.stringify(fields.map((field) => target[field]));
        if (seen[index].has(key)) fail(location, "duplicate business key");
        seen[index].add(key);
      });
      return target;
    });
    tables[model.table] = output;
    summaries.push({
      source: sourceName,
      target: model.table,
      rows: output.length,
      sha256: createHash("sha256").update(JSON.stringify(output)).digest("hex"),
    });
  }
  // Validate all modeled foreign keys before writing any output, including composite references.
  const modelsByName = new Map(contract.models.map((model) => [model.name, model]));
  for (const model of contract.models) {
    for (const relation of model.relations.filter((relation) => relation.fields.length)) {
      const referenced = modelsByName.get(relation.targetModel);
      if (!referenced || relation.references.length !== relation.fields.length)
        fail(model.table, "unsupported relationship");
      const targetKeys = new Set(
        tables[referenced.table].map((row) =>
          JSON.stringify(relation.references.map((field) => row[field])),
        ),
      );
      for (const [index, row] of tables[model.table].entries()) {
        const values = relation.fields.map((field) => row[field]);
        if (values.some((value) => value === null)) continue;
        if (!targetKeys.has(JSON.stringify(values)))
          fail(`${model.table}[${index}].${relation.name}`, "missing referenced row");
      }
    }
  }
  return {
    tables,
    manifest: {
      version: 1,
      sourceSchemaSha256: contract.sourceSha256,
      schemaOnlyCoverage: true,
      accountsAndFilesMigrated: false,
      summaries,
    },
  };
}
