import { describe, expect, it } from "vitest";
import { companyInputSchema, companyListQuerySchema, companyUpdateSchema } from "./company-schemas";

describe("company schemas", () => {
  it("trims input and converts empty optional fields", () => {
    const result = companyInputSchema.parse({
      name: "  Nova Conseil  ",
      email: "  ",
      employeeCount: "",
      status: "prospect",
    });
    expect(result).toEqual({
      name: "Nova Conseil",
      email: undefined,
      employeeCount: undefined,
      status: "prospect",
    });
  });

  it("rejects invalid email, website and employee count", () => {
    expect(companyInputSchema.safeParse({ name: "Nova", email: "invalid" }).success).toBe(false);
    expect(
      companyInputSchema.safeParse({ name: "Nova", website: "ftp://example.com" }).success,
    ).toBe(false);
    expect(companyInputSchema.safeParse({ name: "Nova", employeeCount: -1 }).success).toBe(false);
  });

  it("rejects empty updates", () => {
    expect(companyUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("applies bounded pagination and whitelisted sorting", () => {
    expect(companyListQuerySchema.parse({})).toMatchObject({
      page: 1,
      pageSize: 20,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    expect(companyListQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
    expect(companyListQuerySchema.safeParse({ sortBy: "organizationId" }).success).toBe(false);
    expect(companyListQuerySchema.parse({ includeArchived: "true" }).includeArchived).toBe(true);
  });
});
