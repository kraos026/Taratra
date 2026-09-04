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
      audit: "/companies",
      opportunities: "/recommendations",
      roi: "/companies",
      actionPlan: "/recommendations",
      results: "/companies",
      newAudit: "/companies",
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

  it("exposes the advanced-audit and company-analysis navigation controls", () => {
    const dashboard = readFileSync(
      join(process.cwd(), "src/components/dashboard/interactive-dashboard.tsx"),
      "utf8",
    );
    expect(dashboard).toContain("href={dashboardRoutes.companies}");
    expect(dashboard).toContain("/automation-audit");
    expect(dashboard).toContain("customerJourneyRoutes");
    expect(dashboard).toContain("activeRoutes.opportunities");
    expect(dashboard).toContain("onSubmit={search}");
  });

  it("marks unsupported dashboard controls as disabled", () => {
    const dashboard = readFileSync(
      join(process.cwd(), "src/components/dashboard/interactive-dashboard.tsx"),
      "utf8",
    );
    expect(dashboard).toContain("PilotFeedbackDialog");
    expect(dashboard).toContain("Filtrage temporel bientôt disponible");
    expect(dashboard).toContain("Activation commerciale après validation");
  });

  it("keeps dashboard and recommendations language customer-facing", () => {
    const files = [
      "src/components/dashboard/interactive-dashboard.tsx",
      "src/components/dashboard/feature-directory-page.tsx",
      "src/app/recommendations/page.tsx",
    ];
    const offenders = files.filter((file) =>
      /tenant-scoped|Sélectionnez une entreprise|Pilot only|Feedback pilote|organisation pilote|dossier pilote/i.test(
        readFileSync(join(process.cwd(), file), "utf8"),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("keeps the recommendation bridge aligned with the engine sequence", () => {
    const bridge = readFileSync(
      join(process.cwd(), "src/components/dashboard/feature-directory-page.tsx"),
      "utf8",
    );
    const journey = readFileSync(
      join(process.cwd(), "src/modules/assisted-audit/presentation/canonical-journey.ts"),
      "utf8",
    );
    expect(bridge).toContain("Parcours moteur");
    expect(bridge).toContain("buildCustomerJourney");
    expect(journey).toContain("DISCOVERY");
    expect(journey).toContain("INTERVIEW");
    expect(journey).toContain("KNOWLEDGE");
    expect(journey).toContain("PROCESS_MAP");
    expect(journey).toContain("BUSINESS_ANALYSIS");
    expect(journey).toContain("AI_OPPORTUNITIES");
    expect(journey).toContain("AUTOMATION_OPPORTUNITIES");
    expect(journey).toContain("ROI");
    expect(journey).toContain("RECOMMENDATIONS");
    expect(journey).toContain("COMPLETED");
  });
});
