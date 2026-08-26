import type { BrowserContextOptions } from "@playwright/test";

export type PilotE2EConfig = {
  baseUrl: string;
  userAEmail: string;
  userAPassword: string;
  userBEmail: string;
  userBPassword: string;
  vercelAutomationBypassSecret?: string;
};

const requiredNames = [
  "AUTOMATEX_E2E_BASE_URL",
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "E2E_USER_A_EMAIL",
  "E2E_USER_A_PASSWORD",
  "E2E_USER_B_EMAIL",
  "E2E_USER_B_PASSWORD",
] as const;

export function readPilotE2EConfig(env: NodeJS.ProcessEnv): PilotE2EConfig | null {
  const values = pilotValues(env);
  if (
    !values.AUTOMATEX_E2E_BASE_URL ||
    !values.DATABASE_URL ||
    !values.NEXT_PUBLIC_SUPABASE_URL ||
    !values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    !values.E2E_USER_A_EMAIL ||
    !values.E2E_USER_A_PASSWORD ||
    !values.E2E_USER_B_EMAIL ||
    !values.E2E_USER_B_PASSWORD
  )
    return null;
  const baseUrl = values.AUTOMATEX_E2E_BASE_URL!;
  const vercelAutomationBypassSecret = env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (isVercelPreview(baseUrl) && !vercelAutomationBypassSecret) return null;

  return {
    baseUrl,
    userAEmail: values.E2E_USER_A_EMAIL!,
    userAPassword: values.E2E_USER_A_PASSWORD!,
    userBEmail: values.E2E_USER_B_EMAIL!,
    userBPassword: values.E2E_USER_B_PASSWORD!,
    vercelAutomationBypassSecret,
  };
}

export function missingPilotE2EVariables(env: NodeJS.ProcessEnv): readonly string[] {
  const values = pilotValues(env);
  const missing = requiredNames.filter((name) => !values[name]);
  const baseUrl = env.AUTOMATEX_E2E_BASE_URL?.trim();
  if (baseUrl && isVercelPreview(baseUrl) && !env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim())
    return [...missing, "VERCEL_AUTOMATION_BYPASS_SECRET"];
  return missing;
}

export const pilotRequiredEnvironmentNames = requiredNames;

export function pilotBrowserContextOptions(config: PilotE2EConfig): BrowserContextOptions {
  return {
    baseURL: config.baseUrl,
    extraHTTPHeaders: config.vercelAutomationBypassSecret
      ? { "x-vercel-protection-bypass": config.vercelAutomationBypassSecret }
      : undefined,
  };
}

function isVercelPreview(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

function pilotValues(env: NodeJS.ProcessEnv): Record<(typeof requiredNames)[number], string> {
  return {
    AUTOMATEX_E2E_BASE_URL: env.AUTOMATEX_E2E_BASE_URL?.trim() ?? "",
    DATABASE_URL: env.DATABASE_URL?.trim() ?? "",
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "",
    E2E_USER_A_EMAIL:
      env.E2E_USER_A_EMAIL?.trim() ?? env.AUTOMATEX_STAGING_TENANT_A_EMAIL?.trim() ?? "",
    E2E_USER_A_PASSWORD:
      env.E2E_USER_A_PASSWORD?.trim() ?? env.AUTOMATEX_STAGING_TENANT_A_PASSWORD?.trim() ?? "",
    E2E_USER_B_EMAIL:
      env.E2E_USER_B_EMAIL?.trim() ?? env.AUTOMATEX_STAGING_TENANT_B_EMAIL?.trim() ?? "",
    E2E_USER_B_PASSWORD:
      env.E2E_USER_B_PASSWORD?.trim() ?? env.AUTOMATEX_STAGING_TENANT_B_PASSWORD?.trim() ?? "",
  };
}
