import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { useState } from "react";
import { CompaniesList } from "./companies-list";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: vi.fn(),
}));

describe("company creation navigation", () => {
  beforeEach(() => vi.mocked(useState).mockReset());

  function render(canWrite: boolean, loading = false, error?: string) {
    const page = {
      items: [{ id: "company-a", name: "Existing dossier", status: "client" }],
      permissions: { canWrite, canDelete: false },
    };
    vi.mocked(useState)
      .mockReturnValueOnce([page, vi.fn()])
      .mockReturnValueOnce([error, vi.fn()])
      .mockReturnValueOnce([loading, vi.fn()]);
    return renderToStaticMarkup(<CompaniesList />);
  }

  it("offers a separate new dossier when a writable company already exists", () => {
    const html = render(true);
    expect(html).toContain('href="/companies/new"');
    expect(html).toContain("Créer un nouveau dossier");
    expect(html).toContain("Existing dossier");
    expect(html).toContain('href="/companies/company-a/automation-audit"');
  });
  it("does not offer creation to a read-only member", () => {
    expect(render(false)).not.toContain('href="/companies/new"');
  });
  it("does not offer creation while loading", () => {
    expect(render(true, true)).not.toContain('href="/companies/new"');
  });
  it("does not offer creation after a permission fetch failure", () => {
    expect(render(true, false, "Unavailable")).not.toContain('href="/companies/new"');
  });
});
