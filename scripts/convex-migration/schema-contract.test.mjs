import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parsePrismaSchema, renderConvexSchema } from "./schema-contract.mjs";

const sample = `model Ledger {
 id String @id @db.Uuid
 amount Decimal @map("amount_exact") @db.Decimal(20, 8)
 optional Decimal?
 organizationId String @unique
 @@index([organizationId])
 @@map("ledgers")
}`;
describe("Prisma to Convex migration contract", () => {
  it("preserves exact decimal encodings, nullability and business identifiers", () => {
    const contract = parsePrismaSchema(sample);
    expect(contract.models[0].fields[1]).toMatchObject({
      name: "amount",
      column: "amount_exact",
      type: "Decimal",
    });
    const rendered = renderConvexSchema(contract);
    expect(rendered).toContain("amount: v.string()");
    expect(rendered).toContain("optional: v.union(v.string(), v.null())");
    expect(rendered).toContain('index("by_business_id", ["id"])');
    expect(rendered).not.toContain('index("by_id"');
  });
  it("retains uniqueness metadata when a non-unique index repeats fields", () => {
    expect(
      parsePrismaSchema(sample).models[0].indexes.find(
        (index) => index.fields[0] === "organizationId",
      ).unique,
    ).toBe(true);
  });
  it("rejects unsupported types and colliding target tables", () => {
    expect(() => parsePrismaSchema(sample.replace("Decimal?", "Unsupported?"))).toThrow(
      "Unsupported scalar type",
    );
    expect(() => parsePrismaSchema(sample + "\n" + sample.replace("Ledger", "Other"))).toThrow(
      "Colliding SQL table names",
    );
  });
  it("maps all current models deterministically, including composite keys and relations", () => {
    const source = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
    const contract = parsePrismaSchema(source);
    expect(contract.models).toHaveLength(125);
    expect(
      contract.models.flatMap((model) => model.fields).filter((field) => field.type === "Decimal"),
    ).toHaveLength(85);
    const memberships = contract.models.find((model) => model.table === "organization_members");
    expect(memberships.primaryKey).toEqual(["organizationId", "userId"]);
    expect(memberships.relations.length).toBeGreaterThan(0);
    expect(renderConvexSchema(parsePrismaSchema(source))).toBe(renderConvexSchema(contract));
  });
});
