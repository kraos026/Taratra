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
});
