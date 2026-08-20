import { spawnSync } from "node:child_process";

const envCheck = spawnSync(process.execPath, ["scripts/validate-pilot-certification-env.mjs"], {
  stdio: "inherit",
  shell: false,
});
if (envCheck.status !== 0) process.exit(envCheck.status ?? 1);

const commands = [
  ["npx", ["prisma", "validate"]],
  ["npx", ["prisma", "generate"]],
  ["npx", ["prisma", "migrate", "status"]],
  ["npm", ["run", "test:rls"]],
  ["npx", ["playwright", "test", "tests/e2e/pilot"]],
];

for (const [command, args] of commands) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
