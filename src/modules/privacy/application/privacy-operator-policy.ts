import { z } from "zod";

const staging = "ajvncwsazrhqjlktzojm";
export function privacyOperatorTargetAllowed(env: Record<string, string | undefined>) {
  if (env.VERCEL_ENV === "production") return false;
  try {
    const publicUrl = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    const dbs = [env.DATABASE_URL, env.DIRECT_URL].map((value) => new URL(value ?? ""));
    if (dbs.some((db) => !["postgres:", "postgresql:"].includes(db.protocol))) return false;
    if (env.VERCEL_ENV === "preview") {
      return (
        publicUrl.origin === `https://${staging}.supabase.co` &&
        dbs.every(
          (db) =>
            db.hostname === `db.${staging}.supabase.co` ||
            (db.hostname.endsWith(".pooler.supabase.com") &&
              decodeURIComponent(db.username) === `postgres.${staging}`),
        )
      );
    }
    return (
      env.AUTOMATEX_CERTIFICATION_DB === "true" &&
      env.AUTOMATEX_CERTIFICATION_TARGET === "local" &&
      ["localhost", "127.0.0.1"].includes(publicUrl.hostname) &&
      publicUrl.protocol === "http:" &&
      publicUrl.port === "55021" &&
      dbs.every((db) => ["localhost", "127.0.0.1"].includes(db.hostname) && db.port === "55022")
    );
  } catch {
    return false;
  }
}

export const privacyOperatorInput = z
  .object({
    id: z.string().uuid(),
    expectedRevision: z.number().int().min(0).max(2147483646),
    status: z.enum(["IN_REVIEW", "NEEDS_INFORMATION", "COMPLETED", "DECLINED"]),
    response: z.string().trim().min(5).max(2000),
  })
  .strict();

const transitions: Record<string, readonly string[]> = {
  RECEIVED: ["IN_REVIEW", "NEEDS_INFORMATION", "DECLINED"],
  IN_REVIEW: ["NEEDS_INFORMATION", "COMPLETED", "DECLINED"],
  NEEDS_INFORMATION: ["IN_REVIEW", "COMPLETED", "DECLINED"],
};
export function privacyTransitionAllowed(from: string, to: string) {
  return transitions[from]?.includes(to) ?? false;
}
