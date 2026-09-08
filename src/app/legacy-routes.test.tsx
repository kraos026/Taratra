import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));
import SettingsPage from "./settings/page";
import ReportsPage from "./reports/page";
import RecommendationsPage from "./recommendations/page";

describe("V1 route policy", () => {
  it("redirects unsupported settings instead of showing a legacy surface", () => {
    expect(() => SettingsPage()).toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/");
  });
  it.each([ReportsPage, RecommendationsPage])(
    "keeps directories inside the canonical customer journey",
    (Page) => {
      const html = renderToStaticMarkup(<Page />);
      expect(html).toContain("Chargement du contexte entreprise");
      expect(html).toContain('href="/companies"');
      expect(html).not.toContain("AutomateX");
      expect(html).not.toContain("bg-white p-6");
    },
  );
});
