import { describe, expect, it } from "vitest";
import { auditCreateSchema, auditListSchema } from "./audit-schemas";
describe("audit schemas", () => {
  it("requires company and version UUIDs", () =>
    expect(
      auditCreateSchema.safeParse({ companyId: "x", questionnaireVersionId: "y" }).success,
    ).toBe(false));
  it("uses safe pagination and sorting", () => {
    expect(auditListSchema.parse({})).toMatchObject({
      page: 1,
      pageSize: 20,
      sortBy: "updatedAt",
      sortOrder: "desc",
    });
    expect(auditListSchema.safeParse({ sortBy: "organizationId" }).success).toBe(false);
  });
});
