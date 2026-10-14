import { afterEach, describe, expect, it, vi } from "vitest";
import {
  agentExecutionPolicy,
  agentLabEnabled,
  agentLabVisible,
  agentWorkspaceHref,
} from "./agent-workspace-policy";
afterEach(() => vi.unstubAllEnvs());
describe("Atelier IA isolation from production", () => {
  it("is disabled unless the lab and a known non-production target are explicitly selected", () => {
    expect(agentLabEnabled({})).toBe(false);
    expect(agentLabEnabled({ NEXT_PUBLIC_OPTIVOS_ATELIER_IA_LAB: "1" })).toBe(false);
    expect(
      agentLabEnabled({
        NEXT_PUBLIC_OPTIVOS_ATELIER_IA_LAB: "1",
        AUTOMATEX_CERTIFICATION_TARGET: "local",
      }),
    ).toBe(true);
    expect(
      agentLabEnabled({ NEXT_PUBLIC_OPTIVOS_ATELIER_IA_LAB: "1", VERCEL_ENV: "preview" }),
    ).toBe(true);
    expect(
      agentLabEnabled({
        NEXT_PUBLIC_OPTIVOS_ATELIER_IA_LAB: "1",
        VERCEL_ENV: "production",
        AUTOMATEX_CERTIFICATION_TARGET: "local",
      }),
    ).toBe(false);
    expect(
      agentLabEnabled({ NEXT_PUBLIC_OPTIVOS_ATELIER_IA_LAB: "0", VERCEL_ENV: "preview" }),
    ).toBe(false);
    expect(
      agentLabEnabled({
        NEXT_PUBLIC_OPTIVOS_ATELIER_IA_LAB: "1",
        VERCEL_ENV: "preview",
        AUTOMATEX_CERTIFICATION_TARGET: "production",
      }),
    ).toBe(false);
  });
  it("exposes no live execution or paid budget option", () => {
    expect(agentExecutionPolicy).toMatchObject({
      liveEnabled: false,
      mode: "simulation",
      budgetEuro: 0,
      status: "SHADOW",
    });
  });
  it("uses the verified company context without embedding identifiers or accepting raw paths", () => {
    expect(agentWorkspaceHref()).toBe("/atelier-ia");
    expect(agentWorkspaceHref("company/id")).toBe("/companies/company%2Fid/atelier-ia");
    vi.stubEnv("NEXT_PUBLIC_OPTIVOS_ATELIER_IA_LAB", "0");
    expect(agentLabVisible()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_OPTIVOS_ATELIER_IA_LAB", "1");
    expect(agentLabVisible()).toBe(true);
  });
});
