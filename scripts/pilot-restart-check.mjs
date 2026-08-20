import { spawnSync } from "node:child_process";

const command = process.env.AUTOMATEX_PILOT_RESTART_COMMAND;
if (!command) {
  console.error(
    "RESTART HARNESS PENDING: set AUTOMATEX_PILOT_RESTART_COMMAND to the staging app restart command.",
  );
  process.exit(2);
}

const result = spawnSync(command, { shell: true, stdio: "inherit" });
process.exit(result.status ?? 1);
