import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
describe("Recommendation boundary", () => {
  it("does not consume Discovery or Interview or recalculate ROI", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/modules/recommendation-portfolios/infrastructure/prisma-recommendation-portfolio-repository.ts",
      ),
      "utf8",
    );
    expect(source).not.toMatch(
      /companyProfile|discovery|interviewAnswer|RoiEvaluationEngine|RoiEngine/i,
    );
    expect(source).toContain("roiEvaluationSnapshot");
  });
});
