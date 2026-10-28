import { query } from "./_generated/server";
export const status = query({
  args: {},
  handler: () => ({
    backend: "convex",
    schemaVersion: 1,
    stage: "migration-foundation",
    applicationCutover: false,
    publicSignUp: process.env.OPTIVOS_CONVEX_FRESH_PILOT === "1",
  }),
});
