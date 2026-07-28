import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const domainDirectory = join(process.cwd(), "src", "modules", "automation-generator", "domain");

describe("Automation Generator domain boundary", () => {
  it("contains no Infrastructure, REST or persistence layer", () => {
    const boundedContextDirectory = join(domainDirectory, "..");
    expect(
      readdirSync(boundedContextDirectory).filter(
        (entry) => entry !== "domain" && entry !== "application",
      ),
    ).toEqual([]);
  });

  it("imports no bounded context, Prisma, PostgreSQL, NestJS or vendor SDK", () => {
    const source = domainSource();
    expect(source).not.toMatch(/from\s+["']@\/modules\//);
    expect(source).not.toMatch(/@prisma|generated\/prisma|PrismaClient/i);
    expect(source).not.toMatch(
      /\bpostgres(?:ql)?\b|@nestjs|n8n|make\.com|zapier|temporal|camunda/i,
    );
  });

  it("contains neither unvalidated TypeScript casts nor eval", () => {
    const source = domainSource();
    expect(source).not.toMatch(/\bas\s+(?:unknown|any|const)\b/);
    expect(source).not.toMatch(/\beval\s*\(/);
  });
});

function domainSource(): string {
  return files(domainDirectory)
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
