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
  it("supports the bounded data request surface without claiming complete export or erasure", () => {
    const html = renderToStaticMarkup(<SettingsPage />);
    expect(html).toContain("Vos données et votre compte");
    expect(html).toContain("Ce n’est pas un export complet du compte.");
    expect(html).toContain("L’ouverture de cet email ne l’envoie pas");
    expect(html).toContain("n’efface pas automatiquement");
    expect(html).toContain('href="/companies"');
    expect(html).toContain("mailto:kraosltd2@gmail.com");
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
