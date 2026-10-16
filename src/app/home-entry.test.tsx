import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/components/dashboard/interactive-dashboard", () => ({
  InteractiveDashboard: () => null,
}));
import Home from "./page";

beforeEach(() => {
  redirect.mockReset().mockImplementation((path: string) => {
    throw new Error(path);
  });
  vi.stubEnv("NEXT_PUBLIC_OPTIVOS_ATELIER_IA_LAB", "1");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("AUTOMATEX_CERTIFICATION_TARGET", "staging");
});
afterEach(() => vi.unstubAllEnvs());
describe("staging workspace entry preserves audit and production", () => {
  it("opens the conversation workspace on the enabled Preview", async () => {
    await expect(Home({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "/atelier-ia/entreprises",
    );
    expect(redirect).toHaveBeenCalledExactlyOnceWith("/atelier-ia/entreprises");
  });
  it("keeps the audit overview directly accessible", async () => {
    expect(await Home({ searchParams: Promise.resolve({ view: "audit" }) })).toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });
  it("never redirects Production even when the visible lab flag is set", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(await Home({ searchParams: Promise.resolve({}) })).toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });
  it("keeps the existing landing when the lab is disabled or the target is production", async () => {
    vi.stubEnv("NEXT_PUBLIC_OPTIVOS_ATELIER_IA_LAB", "0");
    expect(await Home({ searchParams: Promise.resolve({}) })).toBeDefined();
    vi.stubEnv("NEXT_PUBLIC_OPTIVOS_ATELIER_IA_LAB", "1");
    vi.stubEnv("AUTOMATEX_CERTIFICATION_TARGET", "production");
    expect(await Home({ searchParams: Promise.resolve({}) })).toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });
});
