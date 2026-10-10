import { describe, expect, it } from "vitest";
import {
  privacyOperatorInput,
  privacyOperatorTargetAllowed,
  privacyTransitionAllowed,
} from "./privacy-operator-policy";

const stagingEnv = {
  VERCEL_ENV: "preview",
  NEXT_PUBLIC_SUPABASE_URL: "https://ajvncwsazrhqjlktzojm.supabase.co",
  DATABASE_URL:
    "postgresql://postgres.ajvncwsazrhqjlktzojm:synthetic@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
  DIRECT_URL: "postgresql://postgres:synthetic@db.ajvncwsazrhqjlktzojm.supabase.co:5432/postgres",
};
describe("privacy operator scope", () => {
  it("allows only fully coherent staging preview", () =>
    expect(privacyOperatorTargetAllowed(stagingEnv)).toBe(true));
  it.each([
    { VERCEL_ENV: "production" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://mekihopfrfmqnhmtktgr.supabase.co" },
    { DIRECT_URL: "postgresql://postgres:synthetic@db.mekihopfrfmqnhmtktgr.supabase.co/postgres" },
    { DATABASE_URL: "postgresql://postgres.ajvncwsazrhqjlktzojm:synthetic@evil.example/postgres" },
    { DATABASE_URL: "invalid" },
    { DIRECT_URL: "https://db.ajvncwsazrhqjlktzojm.supabase.co" },
    { VERCEL_ENV: undefined },
  ])("denies mixed, production or unknown targets %j", (override) =>
    expect(privacyOperatorTargetAllowed({ ...stagingEnv, ...override })).toBe(false),
  );
  it("permits guarded local certification only", () => {
    const local = {
      AUTOMATEX_CERTIFICATION_DB: "true",
      AUTOMATEX_CERTIFICATION_TARGET: "local",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55021",
      DATABASE_URL: "postgresql://postgres:synthetic@127.0.0.1:55022/postgres",
      DIRECT_URL: "postgresql://postgres:synthetic@127.0.0.1:55022/postgres",
    };
    expect(privacyOperatorTargetAllowed(local)).toBe(true);
    expect(privacyOperatorTargetAllowed({ ...local, AUTOMATEX_CERTIFICATION_DB: undefined })).toBe(
      false,
    );
    expect(privacyOperatorTargetAllowed({ ...local, VERCEL_ENV: "production" })).toBe(false);
  });
});
describe("manual response contract", () => {
  const input = {
    id: "11111111-1111-4111-8111-111111111111",
    expectedRevision: 0,
    status: "IN_REVIEW",
    response: "Demande prise en charge.",
  };
  it("accepts a bounded response", () =>
    expect(privacyOperatorInput.safeParse(input).success).toBe(true));
  it.each([
    { response: " " },
    { response: "a".repeat(2001) },
    { expectedRevision: -1 },
    { expectedRevision: 0.5 },
    { operatorId: input.id },
    { requesterId: input.id },
    { status: "RECEIVED" },
  ])("rejects invalid or forged input %j", (override) =>
    expect(privacyOperatorInput.safeParse({ ...input, ...override }).success).toBe(false),
  );
  it("keeps terminal decisions immutable", () => {
    for (const status of ["COMPLETED", "DECLINED"])
      for (const to of ["IN_REVIEW", "NEEDS_INFORMATION", "COMPLETED", "DECLINED"])
        expect(privacyTransitionAllowed(status, to)).toBe(false);
    expect(privacyTransitionAllowed("RECEIVED", "COMPLETED")).toBe(false);
    expect(privacyTransitionAllowed("IN_REVIEW", "COMPLETED")).toBe(true);
    expect(privacyTransitionAllowed("UNKNOWN", "IN_REVIEW")).toBe(false);
  });
});
