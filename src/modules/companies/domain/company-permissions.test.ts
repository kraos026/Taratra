import { describe, expect, it } from "vitest";
import { canPermanentlyDeleteCompanies, canWriteCompanies } from "./company-permissions";

describe("company permissions", () => {
  it.each(["owner", "admin", "consultant"] as const)("allows %s to write", (role) => {
    expect(canWriteCompanies(role)).toBe(true);
  });

  it("keeps viewers read-only", () => {
    expect(canWriteCompanies("viewer")).toBe(false);
    expect(canPermanentlyDeleteCompanies("viewer")).toBe(false);
  });

  it.each(["owner", "admin"] as const)("allows %s to permanently delete", (role) => {
    expect(canPermanentlyDeleteCompanies(role)).toBe(true);
  });

  it("prevents consultants from permanently deleting", () => {
    expect(canPermanentlyDeleteCompanies("consultant")).toBe(false);
  });
});
