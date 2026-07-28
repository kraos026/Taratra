import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Automation Specification bounded context", () => {
  const root = join(process.cwd(), "src/modules/automation-specifications");

  it("does not depend on forbidden upstream business contexts", () => {
    const source = [
      "domain/automation-specification-engine.ts",
      "application/automation-specification-service.ts",
      "infrastructure/prisma-automation-specification-repository.ts",
    ]
      .map((file) => readFileSync(join(root, file), "utf8"))
      .join("\n");
    expect(source).not.toMatch(
      /modules\/(recommendations|recommendation-portfolios|roi|roi-evaluations|automation-opportunities)/,
    );
  });

  it("keeps the domain free from Prisma, Next, Supabase and Zod", () => {
    const domain = [
      "domain/automation-specification.ts",
      "domain/automation-specification-value-objects.ts",
      "domain/automation-specification-aggregate.ts",
      "domain/automation-specification-engine.ts",
    ]
      .map((file) => readFileSync(join(root, file), "utf8"))
      .join("\n");
    expect(domain).not.toMatch(/@prisma|next\/|supabase|zod/);
  });

  it("keeps application services independent from infrastructure", () => {
    const service = readFileSync(
      join(root, "application/automation-specification-service.ts"),
      "utf8",
    );
    expect(service).not.toMatch(/infrastructure|PrismaAutomationSpecificationRepository/);
  });
});
