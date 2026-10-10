export class ExportLimitError extends Error {}
export function boundedExportRows<T>(rows: T[]): T[] {
  if (rows.length > 1000) throw new ExportLimitError();
  return rows;
}
