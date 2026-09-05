import { missingPilotE2EVariables } from "./support/env";
import { assertPilotTarget } from "../../support/pilot-target-guard";

export default function globalSetup(): void {
  assertPilotTarget(process.env);
  const missing = missingPilotE2EVariables(process.env);
  if (missing.length > 0) {
    throw new Error(
      `CERTIFICATION ENVIRONMENT NOT CONFIGURED. Missing variable names: ${missing.join(", ")}`,
    );
  }
}
