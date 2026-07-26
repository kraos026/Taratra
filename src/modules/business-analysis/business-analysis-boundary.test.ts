import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : /\.(ts|tsx)$/.test(path)
        ? [path]
        : [];
  });
}

describe("Business Analysis bounded-context boundary", () => {
  it("never imports Discovery or Interview", () => {
    const files = sourceFiles(join(process.cwd(), "src", "modules", "business-analysis"));
    const source = files.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(source).not.toMatch(/modules\/(discovery|interviews)/);
    expect(source).not.toMatch(/(Discovery|Interview)(Repository|Service)/);
  });
});
