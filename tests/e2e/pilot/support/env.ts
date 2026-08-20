export type PilotE2EConfig = {
  baseUrl: string;
  userAEmail: string;
  userAPassword: string;
  userBEmail: string;
  userBPassword: string;
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
  const values = Object.fromEntries(
    requiredNames.map((name) => [name, env[name]?.trim()]),
  ) as Record<string, string | undefined>;
  if (requiredNames.some((name) => !values[name])) return null;

  return {
    baseUrl: values.AUTOMATEX_E2E_BASE_URL!,
    userAEmail: values.E2E_USER_A_EMAIL!,
    userAPassword: values.E2E_USER_A_PASSWORD!,
    userBEmail: values.E2E_USER_B_EMAIL!,
    userBPassword: values.E2E_USER_B_PASSWORD!,
  };
}

export function missingPilotE2EVariables(env: NodeJS.ProcessEnv): readonly string[] {
  return requiredNames.filter((name) => !env[name]?.trim());
}

export const pilotRequiredEnvironmentNames = requiredNames;
