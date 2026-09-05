import { readdirSync } from "node:fs";
import path from "node:path";

export function discoverPilotTests(directory = "tests/e2e/pilot") {
  const files = readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return discoverPilotTests(file);
    return entry.isFile() && entry.name.endsWith(".spec.ts") ? [file.replaceAll("\\", "/")] : [];
  });
  return files.sort();
}
