import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
describe("Automation Opportunity bounded-context boundary", () => {
  it("does not consume Discovery or Interview repositories", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/modules/automation-opportunities/infrastructure/prisma-automation-opportunity-repository.ts",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/companyProfile|discovery|interviewAnswer|interviewSession/i);
    expect(source).toContain("aiOpportunitySnapshot");
    expect(source).toContain("analysisSnapshot");
    expect(source).toContain("processMap");
    expect(source).toContain("knowledgeSnapshot");
  });
});
