import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InterviewWizard } from "./interview-wizard";

const state = vi.hoisted(() => ({ values: [] as unknown[] }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: vi.fn(),
  useState: () => [state.values.shift(), vi.fn()],
}));

function prepare(status: string, multipleChoice = false) {
  const question = {
    id: "question-1",
    code: "operations.order_channels",
    domain: "operations",
    prompt: "Comment les demandes sont-elles reçues ?",
    answerType: "multiple_choice",
    options: ["email", "telephone", "website"],
    mandatory: true,
  };
  state.values = [
    {
      session: { id: "session-1", lockVersion: 1, status },
      nextQuestion: multipleChoice ? question : null,
      progress: {
        progressPercentage: 100,
        confidencePercentage: 100,
        missingMandatory: [],
        readyForProcessMapping: true,
        domains: [],
      },
      answers: [],
      questions: [question],
    },
    "email,website",
    "confirmed",
    false,
    "",
  ];
}

function render(status: string, multipleChoice = false) {
  prepare(status, multipleChoice);
  return renderToStaticMarkup(createElement(InterviewWizard, { companyId: "company-1" }));
}

function findAction(node: ReactNode, label: string): (() => Promise<void>) | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const action = findAction(child, label);
      if (action) return action;
    }
  }
  if (isValidElement<{ children?: ReactNode; onClick?: () => Promise<void> }>(node)) {
    if (node.props.children === label) return node.props.onClick;
    return findAction(node.props.children, label);
  }
}

describe("Interview wizard regression gates", () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    state.values = [];
  });

  it("offers every allowed multiple choice with persisted selection", () => {
    const html = render("in_progress", true);
    expect(html.match(/type="checkbox"/g)).toHaveLength(3);
    expect(html.match(/checked=""/g)).toHaveLength(2);
    for (const option of ["email", "telephone", "website"])
      expect(html).toContain(`value="${option}"`);
    for (const label of ["E-mail", "Téléphone", "Site internet"]) expect(html).toContain(label);
  });

  it("requires completion before presenting explicit validation", () => {
    expect(render("in_progress")).toContain("Terminer l’entretien");
    const completed = render("completed");
    expect(completed).toContain("Valider l’entretien et continuer");
    expect(completed).not.toContain("Terminer l’entretien");
  });

  it("shows a French single choice while retaining its canonical value", () => {
    prepare("in_progress", true);
    const view = state.values[0] as {
      nextQuestion: { code: string; answerType: string; options: string[] };
    };
    view.nextQuestion = {
      ...view.nextQuestion,
      code: "finance.invoice_mode",
      answerType: "single_choice",
      options: ["manual", "mixed", "automatic"],
    };
    const html = renderToStaticMarkup(createElement(InterviewWizard, { companyId: "company-1" }));
    expect(html).toContain('value="manual">Manuel</option>');
    expect(html).toContain('value="mixed">Partiellement automatisé</option>');
    expect(html).toContain('value="automatic">Automatique</option>');
  });

  it("uses the same choice labels in the persisted review", () => {
    prepare("in_progress");
    const view = state.values[0] as { answers: unknown[] };
    view.answers = [
      { questionId: "question-1", value: ["email", "website"], confidence: "confirmed" },
    ];
    const html = renderToStaticMarkup(createElement(InterviewWizard, { companyId: "company-1" }));
    expect(html).toContain("E-mail, Site internet");
  });

  it("submits untranslated multiple-choice values", async () => {
    prepare("in_progress", true);
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
    vi.stubGlobal("fetch", request);
    const action = findAction(
      InterviewWizard({ companyId: "company-1" }),
      "Enregistrer et continuer",
    );
    await action!();
    const options = request.mock.calls[0][1] as { body: string };
    expect(JSON.parse(options.body).value).toEqual(["email", "website"]);
  });

  it.each([
    ["in_progress", "Terminer l’entretien", "complete"],
    ["completed", "Valider l’entretien et continuer", "validate"],
  ])("wires %s to its existing server transition", async (status, label, endpoint) => {
    prepare(status);
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
    vi.stubGlobal("fetch", request);
    const action = findAction(InterviewWizard({ companyId: "company-1" }), label);
    expect(action).toBeDefined();
    await action!();
    expect(request).toHaveBeenCalledExactlyOnceWith(`/api/interviews/session-1/${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: undefined,
    });
  });

  it.each(["validated", "archived"])("keeps %s read-only with a next-step link", (status) => {
    const html = render(status);
    expect(html).toContain("Voir la suite de l’audit");
    expect(html).not.toContain("Valider l’entretien et continuer");
    expect(html).not.toContain("Terminer l’entretien");
  });
});
