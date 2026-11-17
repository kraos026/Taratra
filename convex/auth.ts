import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";

export const authComponent = createClient<DataModel>(components.betterAuth);
export function createAuth(ctx: GenericCtx<DataModel>) {
  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) throw new Error("SITE_URL is required");
  const freshPilot = process.env.OPTIVOS_CONVEX_FRESH_PILOT === "1";
  return betterAuth({
    baseURL: siteUrl,
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !freshPilot,
      requireEmailVerification: !freshPilot,
      minPasswordLength: 12,
    },
    plugins: [convex({ authConfig })],
  });
}
