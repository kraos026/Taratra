import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
describe("real pilot dashboard", () => {
  it("uses tenant companies and the Assisted Audit read model without static pilot metrics", () => {
    const dashboard = readFileSync(
      join(process.cwd(), "src/components/dashboard/interactive-dashboard.tsx"),
      "utf8",
    );
    const loader = readFileSync(
      join(process.cwd(), "src/modules/pilot-dashboard/infrastructure/load-pilot-dashboard.ts"),
      "utf8",
    );
    expect(dashboard).toContain("/automation-audit");
    expect(dashboard).toContain("advancedAudits");
    expect(loader).toContain("AssistedAuditService");
    expect(dashboard).not.toMatch(/Nova Conseil|Clinique Lumi|47|186 h|progress:\s*68/);
  });
});
