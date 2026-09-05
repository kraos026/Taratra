import { describe, expect, it } from "vitest";
import { discoverPilotTests } from "./pilot-test-files.mjs";

describe("local certification pilot inventory", () => {
  it("includes resilience regressions and keeps isolation first and final readback last", () => {
    const files = discoverPilotTests();
    expect(files).toContain("tests/e2e/pilot/auth-resilience.spec.ts");
    expect(files).toContain("tests/e2e/pilot/discovery-resilience.spec.ts");
    expect(files[0]).toBe("tests/e2e/pilot/00-tenant-isolation.spec.ts");
    expect(files.at(-1)).toBe("tests/e2e/pilot/zz-decision-center.spec.ts");
    expect(files.every((file) => file.endsWith(".spec.ts"))).toBe(true);
    expect(new Set(files).size).toBe(files.length);
  });
});
