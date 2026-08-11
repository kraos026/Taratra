import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layouts = [
  "src/app/companies/layout.tsx",
  "src/app/audits/layout.tsx",
  "src/app/questionnaires/layout.tsx",
  "src/app/recommendations/layout.tsx",
  "src/app/reports/layout.tsx",
  "src/app/settings/layout.tsx",
];

describe("authenticated application shell", () => {
  it.each(layouts)("uses the canonical AppShell in %s", (file) => {
    expect(readFileSync(resolve(root, file), "utf8")).toContain("<AppShell>");
  });

  it("uses the same shell on the overview", () => {
    expect(
      readFileSync(resolve(root, "src/components/dashboard/interactive-dashboard.tsx"), "utf8"),
    ).toContain("<AppShell>");
  });

  it("contains no placeholder hash links in product sources", () => {
    const files = [
      ...layouts,
      "src/components/app-shell/app-shell.tsx",
      "src/components/dashboard/interactive-dashboard.tsx",
    ];
    for (const file of files) {
      expect(readFileSync(resolve(root, file), "utf8")).not.toMatch(/href=["']#["']/);
    }
  });
});
