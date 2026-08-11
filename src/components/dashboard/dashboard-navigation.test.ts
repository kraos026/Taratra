import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { companyRoute, dashboardRoutes, dashboardSearchRoute } from "./dashboard-navigation";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : /\.(?:ts|tsx)$/.test(entry)
        ? [path]
        : [];
  });
}

describe("dashboard interactions", () => {
  it("maps every sidebar entry to a real route", () => {
    expect(dashboardRoutes).toEqual({
      overview: "/",
      companies: "/companies",
      crm: "/companies?view=crm",
      audits: "/audits",
      recommendations: "/recommendations",
      reports: "/reports",
      knowledge: "/questionnaires",
      settings: "/settings",
      newAudit: "/audits/new",
    });
    expect(Object.values(dashboardRoutes)).not.toContain("#");
  });

  it("builds tenant-safe paths without hardcoded identifiers", () => {
    expect(companyRoute("company-id")).toBe("/companies/company-id");
    expect(companyRoute("company/id")).toBe("/companies/company%2Fid");
  });

  it("connects search to the company list", () => {
    expect(dashboardSearchRoute(" Nova Conseil ")).toBe("/companies?search=Nova%20Conseil");
    expect(dashboardSearchRoute("   ")).toBe("/companies");
  });

  it("contains no href placeholder anywhere in src", () => {
    const offenders = sourceFiles(join(process.cwd(), "src")).filter((file) =>
      /href\s*=\s*["'](?:#|\s*)["']/.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("exposes canonical shell navigation and dashboard company navigation", () => {
    const dashboard = readFileSync(
      join(process.cwd(), "src/components/dashboard/interactive-dashboard.tsx"),
      "utf8",
    );
    const shell = readFileSync(
      join(process.cwd(), "src/components/app-shell/app-shell.tsx"),
      "utf8",
    );
    expect(shell).toContain('href="/audits/new"');
    expect(shell).toContain("onSubmit={search}");
    expect(dashboard).toContain("href={companyRoute(company.id)}");
    expect(dashboard).toContain("href={dashboardRoutes.audits}");
  });

  it("marks unsupported subscription controls as unavailable", () => {
    const shell = readFileSync(
      join(process.cwd(), "src/components/app-shell/app-shell.tsx"),
      "utf8",
    );
    expect(shell).toContain("Bientôt disponible");
    expect(shell).toContain("disabled");
  });
});
