import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
function files(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(path) ? [path] : [];
  });
}
describe("AI Opportunity bounded-context boundary", () => {
  it("never imports Discovery or Interview", () => {
    const source = files(join(process.cwd(), "src", "modules", "ai-opportunities"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    expect(source).not.toMatch(/modules\/(discovery|interviews)/);
    expect(source).not.toMatch(/(Discovery|Interview)(Repository|Service)/);
  });
});
