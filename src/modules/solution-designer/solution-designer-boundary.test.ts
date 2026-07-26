import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
describe("Solution Designer boundary", () => {
  it("does not depend on forbidden V1 bounded contexts or generators", () => {
    const root = join(process.cwd(), "src/modules/solution-designer");
    const files = [
      "domain/solution-designer.ts",
      "application/solution-blueprint-service.ts",
      "infrastructure/prisma-solution-blueprint-repository.ts",
    ];
    const source = files.map((file) => readFileSync(join(root, file), "utf8")).join("\n");
    expect(source).not.toMatch(
      /modules\/(discovery|interviews|knowledge|process-mapping|business-analysis|ai-opportunities)/,
    );
    expect(source).not.toMatch(/workflow generator|deployment engine/i);
  });

  it("keeps application independent from Prisma and validation rules outside the engine", () => {
    const root = join(process.cwd(), "src/modules/solution-designer");
    const service = readFileSync(join(root, "application/solution-blueprint-service.ts"), "utf8");
    const engine = readFileSync(join(root, "domain/solution-designer.ts"), "utf8");
    expect(service).not.toMatch(/infrastructure|PrismaSolutionBlueprintRepository/);
    expect(engine).not.toMatch(
      /unknown_pattern|missing_evidence|topology_cycle|forbidden_platform|roi_unpublished/,
    );
  });
});
