import { describe, expect, it } from "vitest";
import { compareMigrationHistory } from "./migration-history.mjs";
const files = ["0001_initial.sql", "20260903090000_add_pilot_feedback.sql"];
const rows = [
  { version: "0001", name: "initial" },
  { version: "20260903090000", name: "add_pilot_feedback" },
];
describe("authoritative Supabase migration history", () => {
  it("matches exact versions and names without losing leading zeroes", () => {
    expect(compareMigrationHistory(files, rows)).toMatchObject({
      matches: true,
      repository: 2,
      applied: 2,
    });
  });
  it("fails when feedback is missing", () =>
    expect(compareMigrationHistory(files, rows.slice(0, 1))).toMatchObject({
      matches: false,
      missing: ["20260903090000"],
    }));
  it("fails on extra history", () =>
    expect(
      compareMigrationHistory(files, [...rows, { version: "9999", name: "other" }]),
    ).toMatchObject({ matches: false, extra: ["9999"] }));
  it("fails on renamed history", () =>
    expect(compareMigrationHistory(files, [{ ...rows[0], name: "wrong" }, rows[1]])).toMatchObject({
      matches: false,
      renamed: ["0001"],
    }));
  it("rejects duplicate repo versions", () =>
    expect(() => compareMigrationHistory([...files, "0001_other.sql"], rows)).toThrow());
  it("rejects empty repo history", () => expect(() => compareMigrationHistory([], [])).toThrow());
});
