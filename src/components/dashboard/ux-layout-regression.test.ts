import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Cross-screen layout safety", () => {
  it("does not override Tailwind's grid utility with dashboard-specific columns", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).not.toMatch(/(?:^|\n)\s*\.grid\s*\{/);
    expect(css).toContain(".dashboard-grid");
  });
  it("keeps authenticated company context on published detail screens", () => {
    for (const route of ["roi", "recommendations", "automation-opportunities"]) {
      const page = readFileSync(`src/app/${route}/[id]/page.tsx`, "utf8");
      expect(page).toContain("<CompanyShell verifiedCompanyId={detail.snapshot.companyId}>");
      expect(page).toContain("notFound()");
    }
  });
});
