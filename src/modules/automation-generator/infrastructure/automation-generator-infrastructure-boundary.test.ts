import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const moduleDirectory = join(process.cwd(), "src", "modules", "automation-generator");

describe("Automation Generator Infrastructure boundary", () => {
  it("does not introduce Infrastructure imports into Domain or Application", () => {
    const protectedSource = source(
      join(moduleDirectory, "domain"),
      join(moduleDirectory, "application"),
    );
    expect(protectedSource).not.toMatch(/from\s+["'][^"']*infrastructure/);
    expect(protectedSource).not.toMatch(/@prisma|generated\/prisma|PrismaClient/);
  });

  it("contains no controller, endpoint, HTTP DTO, vendor workflow, or real compiler", () => {
    const infrastructureSource = source(join(moduleDirectory, "infrastructure"));
    expect(infrastructureSource).not.toMatch(
      /@Controller|NextRequest|NextResponse|Swagger|OpenAPI/,
    );
    expect(infrastructureSource).not.toMatch(/n8n|make\.com|zapier|temporal|camunda/i);
    expect(infrastructureSource).not.toMatch(
      /CanonicalAutomationGraph\.create|new\s+CanonicalNode/,
    );
  });

  it("depends inward on Application ports and Domain contracts", () => {
    const infrastructureSource = source(join(moduleDirectory, "infrastructure"));
    expect(infrastructureSource).toMatch(/application\/automation-generator-application-ports/);
    expect(infrastructureSource).toMatch(/domain\/automation-generator/);
    expect(infrastructureSource).not.toMatch(
      /from\s+["']@\/app|from\s+["']@\/modules\/(?!automation-generator)/,
    );
  });
});

function source(...directories: readonly string[]): string {
  return directories
    .flatMap(files)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
}

function files(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}
