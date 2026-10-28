import { describe, expect, it } from "vitest";
import { parsePrismaSchema } from "./schema-contract.mjs";
import { transformSnapshot } from "./transform.mjs";

const schema = `model Parent {
 id String @id @db.Uuid
 records Record[]
 @@map("parents")
}
model Record {
 id String @id
 parentId String @map("parent_id") @db.Uuid
 amount Decimal
 at DateTime
 parent Parent @relation(fields: [parentId], references: [id])
 @@map("records")
}`;
const contract = parsePrismaSchema(schema);
const parentId = "10000000-0000-4000-8000-000000000001";
const bundle = () => ({
  version: 1,
  tables: {
    "public.parents": [{ id: parentId }],
    "public.records": [
      {
        id: "r1",
        parent_id: parentId,
        amount: "9007199254740993.12345678",
        at: "2026-10-27T00:00:00.123456Z",
      },
    ],
  },
});
describe("Offline Convex import preparation", () => {
  it("preserves amounts and microseconds byte for byte", () => {
    const result = transformSnapshot(contract, bundle());
    expect(result.tables.records[0]).toEqual({
      id: "r1",
      parentId,
      amount: "9007199254740993.12345678",
      at: "2026-10-27T00:00:00.123456Z",
      legacyKey: '["r1"]',
    });
    expect(result.manifest.accountsAndFilesMigrated).toBe(false);
  });
  it("rejects lossy numeric decimals without exposing their values", () => {
    const snapshot = bundle();
    snapshot.tables["public.records"][0].amount = 123.456;
    expect(() => transformSnapshot(contract, snapshot)).toThrow("decimal must be exact text");
    try {
      transformSnapshot(contract, snapshot);
    } catch (error) {
      expect(error.message).not.toContain("123.456");
    }
  });
  it("rejects missing or unmapped tables and extra columns", () => {
    const missing = bundle();
    delete missing.tables["public.parents"];
    expect(() => transformSnapshot(contract, missing)).toThrow("missing table");
    const extra = bundle();
    extra.tables["private.unmapped"] = [];
    expect(() => transformSnapshot(contract, extra)).toThrow("unmapped table");
    const column = bundle();
    column.tables["public.parents"][0].secret = "hidden";
    expect(() => transformSnapshot(contract, column)).toThrow("unmapped source column");
  });
  it("rejects duplicate keys and broken lineage", () => {
    const duplicate = bundle();
    duplicate.tables["public.records"].push({ ...duplicate.tables["public.records"][0] });
    expect(() => transformSnapshot(contract, duplicate)).toThrow("duplicate business key");
    const orphan = bundle();
    orphan.tables["public.parents"] = [];
    expect(() => transformSnapshot(contract, orphan)).toThrow("missing referenced row");
  });
});
