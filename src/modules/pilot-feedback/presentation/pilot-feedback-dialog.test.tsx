import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PilotFeedbackDialog } from "./pilot-feedback-dialog";

describe("PilotFeedbackDialog", () => {
  it("disables feedback until a company context exists", () => {
    const html = renderToStaticMarkup(<PilotFeedbackDialog />);
    expect(html).toContain("Donner mon avis");
    expect(html).toContain("disabled");
  });

  it("renders the compact accessible form for an active company", () => {
    const html = renderToStaticMarkup(<PilotFeedbackDialog companyId="company-a" />);
    expect(html).toContain("Aidez-nous à améliorer Optivos");
    expect(html).toContain("L’audit reflète-t-il bien votre entreprise ?");
    expect(html).toContain("Envisageriez-vous de payer");
    expect(html).toContain("prix acceptable");
    expect(html).toContain('maxLength="2000"');
  });
});
