import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/components/dashboard/interactive-dashboard", () => ({
  InteractiveDashboard: () => null,
}));
import Home from "./page";
import { InteractiveDashboard } from "@/components/dashboard/interactive-dashboard";

beforeEach(() => {
  redirect.mockReset().mockImplementation((path: string) => {
    throw new Error(path);
  });
  vi.stubEnv("NEXT_PUBLIC_OPTIVOS_ATELIER_IA_LAB", "1");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("AUTOMATEX_CERTIFICATION_TARGET", "staging");
});
afterEach(() => vi.unstubAllEnvs());
describe("Optivos audit is the primary home entry", () => {
  it("opens the canonical dashboard even on a Preview with the lab enabled", () => {
    expect(Home().type).toBe(InteractiveDashboard);
    expect(redirect).not.toHaveBeenCalled();
  });
  it("never redirects Production even when the visible lab flag is set", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(Home().type).toBe(InteractiveDashboard);
    expect(redirect).not.toHaveBeenCalled();
  });
  it("keeps the same entry when the lab is disabled or the target is production", () => {
    vi.stubEnv("NEXT_PUBLIC_OPTIVOS_ATELIER_IA_LAB", "0");
    expect(Home().type).toBe(InteractiveDashboard);
    vi.stubEnv("NEXT_PUBLIC_OPTIVOS_ATELIER_IA_LAB", "1");
    vi.stubEnv("AUTOMATEX_CERTIFICATION_TARGET", "production");
    expect(Home().type).toBe(InteractiveDashboard);
    expect(redirect).not.toHaveBeenCalled();
  });
});
