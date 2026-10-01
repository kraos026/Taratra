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
  it("scopes the admin visual treatment to authenticated workspaces", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain(".workspace-content .opt-title");
    expect(css).toContain(".workspace-content .opt-primary");
    expect(css).toContain(".app-shell .search input");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    const shell = readFileSync("src/components/dashboard/company-shell.tsx", "utf8");
    expect(shell).toContain("workspace-content");
    expect(shell).toContain('aria-label="Navigation principale mobile"');
    expect(shell).toContain("href={navigationHref(label, href)}");
  });
  it("keeps the dashboard primary action and decision context visible on mobile", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const workspaceStyles = css.slice(css.indexOf("/* Authenticated workspace:"));
    expect(workspaceStyles).toMatch(/\.app-shell \.cta-link\s*\{\s*display: inline-flex/);
    expect(workspaceStyles).toMatch(/\.app-shell \.activity\s*\{\s*display: block/);
  });
});
