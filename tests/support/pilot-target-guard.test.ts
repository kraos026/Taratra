import { describe, expect, it } from "vitest";
import { assertPilotTarget } from "./pilot-target-guard";

const local = {
  AUTOMATEX_E2E_BASE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55021",
  DATABASE_URL: "postgresql://postgres:fixture@127.0.0.1:55022/postgres",
};
const staging = {
  AUTOMATEX_E2E_BASE_URL: "https://taratra-example-optivos.vercel.app",
  AUTOMATEX_E2E_PREVIEW_URL: "https://taratra-example-optivos.vercel.app",
  AUTOMATEX_E2E_TARGET: "staging",
  NEXT_PUBLIC_SUPABASE_URL: "https://ajvncwsazrhqjlktzojm.supabase.co",
  DATABASE_URL:
    "postgresql://postgres.ajvncwsazrhqjlktzojm:fixture@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
  VERCEL_AUTOMATION_BYPASS_SECRET: "test-only",
};

describe("mutating pilot target safety", () => {
  it("accepts the isolated local stack", () =>
    expect(() => assertPilotTarget(local)).not.toThrow());
  it("accepts an explicitly selected staging Preview", () =>
    expect(() => assertPilotTarget(staging)).not.toThrow());
  it.each([
    { AUTOMATEX_E2E_PREVIEW_URL: undefined },
    { AUTOMATEX_E2E_TARGET: undefined },
    { AUTOMATEX_E2E_PREVIEW_URL: "https://different.vercel.app" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://mekihopfrfmqnhmtktgr.supabase.co" },
    { DATABASE_URL: staging.DATABASE_URL.replace("ajvncwsazrhqjlktzojm", "mekihopfrfmqnhmtktgr") },
    { DIRECT_URL: staging.DATABASE_URL.replace("ajvncwsazrhqjlktzojm", "mekihopfrfmqnhmtktgr") },
    {
      DATABASE_URL: staging.DATABASE_URL.replace(
        "pooler.supabase.com",
        "pooler.supabase.com.evil.example",
      ),
    },
    { VERCEL_AUTOMATION_BYPASS_SECRET: undefined },
    { AUTOMATEX_E2E_BASE_URL: "https://optivos.vip", AUTOMATEX_E2E_ALLOW_PRODUCTION: "true" },
    { AUTOMATEX_E2E_BASE_URL: "http://taratra-example-optivos.vercel.app" },
  ])("rejects unsafe or ambiguous remote configuration %#", (override) => {
    expect(() => assertPilotTarget({ ...staging, ...override })).toThrow("PILOT TARGET REJECTED");
  });
  it.each([
    { NEXT_PUBLIC_SUPABASE_URL: staging.NEXT_PUBLIC_SUPABASE_URL },
    { DATABASE_URL: staging.DATABASE_URL },
    { DIRECT_URL: staging.DATABASE_URL },
    { DATABASE_URL: "invalid-secret-value" },
    { AUTOMATEX_E2E_BASE_URL: "http://localhost:3000/companies" },
  ])("rejects mixed local/remote or malformed targets %#", (override) => {
    expect(() => assertPilotTarget({ ...local, ...override })).toThrow("PILOT TARGET REJECTED");
  });
  it("never includes connection credentials in diagnostic errors", () => {
    try {
      assertPilotTarget({ ...local, DATABASE_URL: "private-password" });
    } catch (error) {
      expect(String(error)).not.toContain("private-password");
    }
  });
});
