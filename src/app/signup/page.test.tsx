import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignUpPage from "./page";

const state = vi.hoisted(() => ({ query: "", createClient: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(state.query),
}));
vi.mock("@/infrastructure/supabase/client", () => ({ createClient: state.createClient }));

describe("signup confirmation feedback", () => {
  beforeEach(() => {
    state.query = "";
    state.createClient.mockClear();
  });

  it("explains the rejected confirmation link without claiming the account is confirmed", () => {
    state.query = "error=confirmation&token_hash=private-token";
    const html = renderToStaticMarkup(<SignUpPage />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("expiré, déjà utilisé ou");
    expect(html).toContain("Si votre adresse est déjà confirmée");
    expect(html).toContain('href="/login"');
    expect(html).toContain("demander un nouvel email");
    expect(html).not.toContain("private-token");
    expect(state.createClient).not.toHaveBeenCalled();
  });

  it.each(["", "error=other", "error=%3Cscript%3Eprivate%3C%2Fscript%3E"])(
    "keeps ordinary signup neutral and does not echo arbitrary query values: %s",
    (query) => {
      state.query = query;
      const html = renderToStaticMarkup(<SignUpPage />);
      expect(html).not.toContain('role="alert"');
      expect(html).not.toContain("private");
      expect(html).toContain('name="email"');
      expect(html).toContain('name="password"');
      expect(html).toContain("Créer mon compte");
      expect(state.createClient).not.toHaveBeenCalled();
    },
  );
});
