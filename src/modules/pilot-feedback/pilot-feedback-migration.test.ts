import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260903090000_add_pilot_feedback.sql"),
  "utf8",
);

describe("pilot feedback migration", () => {
  it("enforces ratings, bounded comments and commercial values", () => {
    expect(sql).toContain("understanding_score between 1 and 5");
    expect(sql).toContain("experience_score between 1 and 5");
    expect(sql).toContain("willing_to_pay in ('YES', 'NO', 'UNSURE')");
    expect(sql).toContain("acceptable_price > 0");
    expect(sql).toContain("comment varchar(2000)");
  });

  it("is idempotent per user and audit context", () => {
    expect(sql).toContain("pilot_feedback_user_audit_key");
    expect(sql).toContain("where audit_id is not null");
    expect(sql).toContain("pilot_feedback_user_company_without_audit_key");
  });

  it("enables RLS and binds reads and writes to auth.uid", () => {
    expect(sql).toContain("enable row level security");
    expect(sql.match(/user_id = \(select auth\.uid\(\)\)/g)).toHaveLength(4);
    expect(sql).not.toContain(" to anon");
    expect(sql).not.toContain("grant all");
  });
});
