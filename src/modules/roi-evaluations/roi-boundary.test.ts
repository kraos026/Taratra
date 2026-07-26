import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
describe("ROI bounded-context boundary", () => {
  it("never reads Discovery or Interview", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/modules/roi-evaluations/infrastructure/prisma-roi-evaluation-repository.ts",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/companyProfile|discovery|interviewAnswer|interviewSession/i);
    expect(source).toContain("automationOpportunitySnapshot");
    expect(source).toContain("aiOpportunitySnapshot");
    expect(source).toContain("analysisSnapshot");
    expect(source).toContain("processMap");
    expect(source).toContain("knowledgeSnapshot");
  });
});
