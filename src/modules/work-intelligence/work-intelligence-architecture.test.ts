import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "src", "modules", "work-intelligence");
const productionFiles = [
  "domain/work-intelligence.ts",
  "application/work-activity-repository.ts",
  "application/work-intelligence-service.ts",
  "infrastructure/in-memory-work-activity-repository.ts",
];

describe("work-intelligence architecture", () => {
  it("does not depend on Runtime, compiler, Prisma, HTTP, or historical process-mapping", () => {
    const source = productionFiles.map((file) => readFileSync(join(root, file), "utf8")).join("\n");
    expect(source).not.toMatch(/from ["'][^"']*(runtime|automation-generator|process-mapping)/i);
    expect(source).not.toMatch(/@prisma|fetch\(|axios|NextRequest|NextResponse/);
  });

  it("keeps domain independent from application and infrastructure", () => {
    const source = readFileSync(join(root, "domain/work-intelligence.ts"), "utf8");
    expect(source).not.toMatch(/application|infrastructure|prisma|supabase/i);
  });
});
