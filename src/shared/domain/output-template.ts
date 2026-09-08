/** Publication guard for unresolved named catalog variables, not JSON object syntax. */
export function hasUnresolvedTemplate(value: unknown): boolean {
  if (typeof value === "string") return /\{[a-zA-Z_][\w.]*\}/.test(value);
  if (Array.isArray(value)) return value.some(hasUnresolvedTemplate);
  if (value && typeof value === "object") return Object.values(value).some(hasUnresolvedTemplate);
  return false;
}

/** Explicit display fallback for older published records; never invent a measurement. */
export function customerOutputText(value: string): string {
  return value.replace(/\{[a-zA-Z_][\w.]*\}/g, "[information à préciser]");
}
