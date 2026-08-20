import { missingPilotE2EVariables } from "./support/env";

export default function globalSetup(): void {
  const missing = missingPilotE2EVariables(process.env);
  if (missing.length > 0) {
    throw new Error(
      `CERTIFICATION ENVIRONMENT NOT CONFIGURED. Missing variable names: ${missing.join(", ")}`,
    );
  }
}
