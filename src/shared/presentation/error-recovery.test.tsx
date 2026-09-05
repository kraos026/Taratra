import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ErrorRecovery } from "./error-recovery";

describe("customer error recovery", () => {
  it("offers an accessible retry and real home link without engine diagnostics", () => {
    const html = renderToStaticMarkup(createElement(ErrorRecovery, { reset: vi.fn() }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Réessayer");
    expect(html).toContain('href="/"');
    expect(html).not.toMatch(/P2028|Prisma|stack trace/);
  });
});
