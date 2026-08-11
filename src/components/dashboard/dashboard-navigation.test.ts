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
  it("maps every sidebar entry to a real non-placeholder route", () => {
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

  it("builds tenant-safe navigation without hardcoded identifiers", () => {
    expect(companyRoute("company-id")).toBe("/companies/company-id");
    expect(companyRoute("company/id")).toBe("/companies/company%2Fid");
  });

  it("connects dashboard search to the existing company list", () => {
    expect(dashboardSearchRoute(" Nova Conseil ")).toBe("/companies?search=Nova%20Conseil");
    expect(dashboardSearchRoute("   ")).toBe("/companies");
  });

  it("contains no href placeholder anywhere in src", () => {
    const offenders = sourceFiles(join(process.cwd(), "src")).filter((file) => {
      const source = readFileSync(file, "utf8");
      return /href\s*=\s*["'](?:#|\s*)["']/.test(source);
    });
    expect(offenders).toEqual([]);
  });

  it("exposes the new-audit and company-analysis navigation controls", () => {
    const dashboard = readFileSync(
      join(process.cwd(), "src/components/dashboard/interactive-dashboard.tsx"),
      "utf8",
    );
    expect(dashboard).toContain("href={dashboardRoutes.newAudit}");
    expect(dashboard).toContain("href={companyRoute(company.id)}");
    expect(dashboard).toContain("href={dashboardRoutes.audits}");
    expect(dashboard).toContain("onSubmit={search}");
  });

  it("marks unsupported dashboard controls as disabled", () => {
    const dashboard = readFileSync(
      join(process.cwd(), "src/components/dashboard/interactive-dashboard.tsx"),
      "utf8",
    );
    expect(dashboard).toContain("Journal d’activité bientôt disponible");
    expect(dashboard).toContain("Filtrage temporel bientôt disponible");
    expect(dashboard).toContain("L’offre Pro n’est pas encore disponible");
  });
});
