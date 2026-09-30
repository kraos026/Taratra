import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Input } from "./input";

describe("Input contrast", () => {
  it("pairs its default white background with explicit dark text", () => {
    const html = renderToStaticMarkup(<Input defaultValue="400" />);
    expect(html).toContain("bg-white");
    expect(html).toContain("text-neutral-900");
  });

  it("allows callers to supply a coherent dark theme", () => {
    const html = renderToStaticMarkup(
      <Input className="bg-slate-950 text-slate-100" defaultValue="400" />,
    );
    expect(html).toContain("bg-slate-950");
    expect(html).toContain("text-slate-100");
    expect(html).not.toContain("bg-white");
    expect(html).not.toContain("text-neutral-900");
  });
});
