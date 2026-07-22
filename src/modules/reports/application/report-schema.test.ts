import { describe, expect, it } from "vitest";
import { reportIdSchema } from "./report-schema";
describe("report API validation", () => {
  it("accepts an audit UUID", () =>
    expect(reportIdSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(true));
  it("rejects an invalid audit id", () =>
    expect(reportIdSchema.safeParse("../other-tenant").success).toBe(false));
});
