export function compareMigrationHistory(files, rows) {
  const expected = files
    .filter((file) => file.endsWith(".sql"))
    .map((file) => {
      const match = /^(\d+)_(.+)\.sql$/.exec(file);
      if (!match) throw new Error("Invalid repository migration filename");
      return { version: match[1], name: match[2] };
    });
  if (!expected.length || new Set(expected.map((row) => row.version)).size !== expected.length)
    throw new Error("Empty or duplicate repository migration history");
  const actual = new Map(rows.map((row) => [String(row.version), row.name]));
  if (actual.size !== rows.length) throw new Error("Duplicate applied migration version");
  const expectedVersions = new Set(expected.map((row) => row.version));
  const missing = expected.filter((row) => !actual.has(row.version)).map((row) => row.version);
  const extra = [...actual.keys()].filter((version) => !expectedVersions.has(version));
  const renamed = expected
    .filter(
      (row) =>
        actual.has(row.version) &&
        actual.get(row.version) != null &&
        actual.get(row.version) !== row.name,
    )
    .map((row) => row.version);
  return {
    repository: expected.length,
    applied: rows.length,
    missing,
    extra,
    renamed,
    matches: !missing.length && !extra.length && !renamed.length,
  };
}
