import { afterAll, describe, expect, it } from "vitest";
import { ESLint } from "eslint";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pluginRequire = createRequire(require.resolve("@next/eslint-plugin-next"));
const { getRootDirs } = pluginRequire("./utils/get-root-dirs.js");
const fixture = mkdtempSync(join(tmpdir(), "optivos-lint-compat-"));
for (const app of ["one", "two"]) {
  mkdirSync(join(fixture, "apps", app, "pages"), { recursive: true });
  writeFileSync(join(fixture, "apps", app, "pages", "billing.tsx"), "");
  mkdirSync(join(fixture, "apps", app, "app", "billing"), { recursive: true });
  writeFileSync(join(fixture, "apps", app, "app", "billing", "page.tsx"), "");
}
afterAll(() => rmSync(fixture, { recursive: true, force: true }));
const normalized = fixture.replaceAll("\\", "/");
const roots = (rootDir) => getRootDirs({ cwd: process.cwd(), settings: { next: { rootDir } } });

describe("scoped Next lint glob replacement", () => {
  it("resolves the reviewed replacement only in the Next plugin", () => {
    expect(pluginRequire("tinyglobby/package.json").version).toBe("0.2.17");
    expect(() => pluginRequire.resolve("fast-glob")).toThrow();
  });

  it("retains default, literal, wildcard, brace and multiple root discovery", () => {
    expect(roots(undefined)).toEqual([process.cwd()]);
    const expected = ["one", "two"].map((app) => `${normalized}/apps/${app}`);
    expect(roots(`${normalized}/apps/one`)).toEqual([expected[0]]);
    expect(roots(`${normalized}/apps/*`).sort()).toEqual(expected);
    expect(roots(`${normalized}/apps/{one,two}`).sort()).toEqual(expected);
    expect(roots(expected).sort()).toEqual(expected);
    expect(roots(`${normalized}/missing/*`)).toEqual([]);
  });

  it("handles deeply nested patterns without stack exhaustion", () => {
    const pattern = "{".repeat(1000) + "not-a-directory" + "}".repeat(1000);
    expect(() => roots(pattern)).toThrow(TypeError);
  });

  it("still detects internal links, sync scripts, accessibility and TypeScript violations", async () => {
    const eslint = new ESLint({
      overrideConfig: { settings: { next: { rootDir: `${normalized}/apps/*` } } },
    });
    const [result] = await eslint.lintText(
      'export default function Probe() { const unsafe: any = 1; return <><a href="/billing">Billing</a><script src="/unsafe.js" /><img src="/image.png" />{unsafe}</>; }',
      { filePath: join(process.cwd(), "src", "lint-compatibility-probe.tsx") },
    );
    const ids = result.messages.map((message) => message.ruleId);
    expect(ids).toContain("@next/next/no-html-link-for-pages");
    expect(ids).toContain("@next/next/no-sync-scripts");
    expect(ids).toContain("jsx-a11y/alt-text");
    expect(ids).toContain("@typescript-eslint/no-explicit-any");
  }, 20000);
});
