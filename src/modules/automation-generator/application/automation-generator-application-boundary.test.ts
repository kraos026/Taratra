import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const moduleDirectory = join(process.cwd(), "src", "modules", "automation-generator");
const applicationDirectory = join(moduleDirectory, "application");

describe("Automation Generator Application boundary", () => {
  it("keeps Domain, Application and Infrastructure as distinct layers", () => {
    expect(readdirSync(moduleDirectory).sort()).toEqual([
      "application",
      "composition",
      "domain",
      "infrastructure",
    ]);
  });

  it("contains no concrete infrastructure, REST, Prisma, SQL or vendor dependency", () => {
    const source = applicationSource();
    expect(source).not.toMatch(/@prisma|generated\/prisma|PrismaClient/i);
    expect(source).not.toMatch(/\bselect\b|\binsert\b|\bupdate\b|\bdelete\b/i);
    expect(source).not.toMatch(/controller|route\.ts|NextRequest|NextResponse|OpenAPI|Swagger/i);
    expect(source).not.toMatch(/n8n|make\.com|zapier|temporal|camunda/i);
  });

  it("does not implement compilation, graph building, hashing or deterministic ids", () => {
    const source = applicationSource();
    expect(source).not.toMatch(/implements\s+GenerationCompiler/);
    expect(source).not.toMatch(/new\s+CanonicalAutomationGraph|CanonicalAutomationGraph\.create/);
    expect(source).not.toMatch(/createHash|node:crypto/);
    expect(source).not.toMatch(
      /implements\s+ContentHasherPort|implements\s+DeterministicIdFactory/,
    );
  });

  it("depends only on its Domain and Application abstractions", () => {
    const source = applicationSource();
    expect(source).not.toMatch(/from\s+["']@\/modules\//);
    expect(source).not.toMatch(/from\s+["']\.\.\/\.\.\/|from\s+["']@\/infrastructure/);
  });
});

function applicationSource(): string {
  return files(applicationDirectory)
    .filter(
      (file) =>
        file.endsWith(".ts") && !file.endsWith(".test.ts") && !file.endsWith("-test-fixtures.ts"),
    )
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
}

function files(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}
