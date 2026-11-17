type DateField =
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
  | "publishedAt"
  | "startedAt"
  | "completedAt"
  | "validatedAt"
  | "archivedAt";
type Business<T> = Omit<T, "_id" | "_creationTime" | "legacyKey">;
type RecordDates<T> = {
  [K in keyof Business<T>]: K extends DateField
    ? null extends Business<T>[K]
      ? Date | null
      : Date
    : Business<T>[K];
};
const dates = new Set<string>([
  "createdAt",
  "updatedAt",
  "deletedAt",
  "publishedAt",
  "startedAt",
  "completedAt",
  "validatedAt",
  "archivedAt",
]);
export function modelRecord<T extends { _id: unknown; _creationTime: number; legacyKey: string }>(
  doc: T,
): RecordDates<T> {
  return Object.fromEntries(
    Object.entries(doc)
      .filter(([key]) => !["_id", "_creationTime", "legacyKey"].includes(key))
      .map(([key, value]) => [
        key,
        dates.has(key) && typeof value === "string" ? new Date(value) : value,
      ]),
  ) as RecordDates<T>;
}
