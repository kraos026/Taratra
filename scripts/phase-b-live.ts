import { readFileSync } from "node:fs";
import {
  FilePhaseBCheckpointStore,
  PhaseBLiveOrchestrator,
} from "../src/brain-evaluation/phase-b-orchestrator";

async function main(): Promise<void> {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]])
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  const args = new Set(process.argv.slice(2));
  const value = (name: string, fallback: string): string => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
  };
  const mode = args.has("--dry-run") ? "DRY_RUN" : "LIVE";
  const benchmarkRunId = value("--benchmark-run-id", "e6.4a-phase-b");
  const maxRuns = Number(value("--max-runs", "5"));
  const orchestrator = new PhaseBLiveOrchestrator({
    benchmarkRunId,
    mode,
    store: new FilePhaseBCheckpointStore(`.automatex/benchmarks/${benchmarkRunId}.json`),
    maxRunsPerBatch: Number.isFinite(maxRuns) && maxRuns > 0 ? maxRuns : 5,
  });
  const batch = await orchestrator.runBatch();
  const report = await orchestrator.report();
  console.log(JSON.stringify({ benchmarkRunId, mode, batch, report }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "benchmark execution failed");
  process.exitCode = 1;
});
