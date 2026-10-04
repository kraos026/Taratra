import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AnalysisRebuildControl } from "./analysis-rebuild-control";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

describe("AnalysisRebuildControl", () => {
  it("clearly describes version preservation and does not imply new evidence or approval", () => {
    const html = renderToStaticMarkup(<AnalysisRebuildControl id="analysis" lockVersion={2} />);
    expect(html).toContain("Créer une nouvelle version de l’analyse");
    expect(html).toContain("L’ancienne analyse reste");
    expect(html).toContain("ne complète pas vos réponses");
    expect(html).toContain("n’approuve aucune décision");
  });
});
