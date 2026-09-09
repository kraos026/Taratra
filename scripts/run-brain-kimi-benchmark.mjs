import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  brainKimiDifficultV3CaseIds,
  createConfiguredBrainKimiBenchmarkProvider,
  runBrainKimiBenchmarkExperiment,
} from "../src/brain-evaluation/canonical-shadow-kimi-adapter.ts";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "..");
const args = new Set(process.argv.slice(2));
const outputDir = join(repoRoot, "artifacts", "brain-benchmark", "kimi-arm-d");
const checkpointPath = join(outputDir, "checkpoint.json");

loadDotEnvLocal(join(repoRoot, ".env.local"));
mkdirSync(outputDir, { recursive: true });

const checkpoint = readCheckpoint(checkpointPath);
const requestedCaseIds = readCaseIds(process.argv.slice(2));
const selectedCaseIds = requestedCaseIds ?? brainKimiDifficultV3CaseIds;
const caseIds = args.has("--failed-only")
  ? checkpoint.failedCaseIds.filter((caseId) => selectedCaseIds.includes(caseId))
  : selectedCaseIds.filter((caseId) => !checkpoint.successfulCaseIds.includes(caseId));

if (caseIds.length === 0) {
  console.log(
    JSON.stringify(
      {
        status: "NO_CASES_TO_RUN",
        checkpoint: summarizeCheckpoint(checkpoint),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const provider = createConfiguredBrainKimiBenchmarkProvider(process.env, fetch);
const result = await runBrainKimiBenchmarkExperiment({
  provider,
  caseIds,
  model: process.env.AUTOMATEX_AI_MODEL,
});
const nextCheckpoint = mergeCheckpoint(checkpoint, result);
writeFileSync(checkpointPath, `${JSON.stringify(nextCheckpoint, null, 2)}\n`);
writeFileSync(
  join(outputDir, "latest-result.json"),
  `${JSON.stringify(summarize(result), null, 2)}\n`,
);
console.log(JSON.stringify(summarize(result), null, 2));

function readCaseIds(values) {
  const ids = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--case" && values[index + 1]) {
      ids.push(values[index + 1]);
      index += 1;
    } else if (value.startsWith("--case=")) {
      ids.push(value.slice("--case=".length));
    }
  }
  return ids.length > 0 ? ids : undefined;
}

function readCheckpoint(path) {
  if (!existsSync(path)) {
    return { successfulCaseIds: [], failedCaseIds: [], updatedAt: null };
  }
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  return {
    successfulCaseIds: Array.isArray(parsed.successfulCaseIds) ? parsed.successfulCaseIds : [],
    failedCaseIds: Array.isArray(parsed.failedCaseIds) ? parsed.failedCaseIds : [],
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
  };
}

function mergeCheckpoint(previous, result) {
  const successful = new Set(previous.successfulCaseIds);
  const failed = new Set(previous.failedCaseIds);
  for (const item of result.perCase) {
    if (item.providerFailure) {
      failed.add(item.caseId);
      continue;
    }
    successful.add(item.caseId);
    failed.delete(item.caseId);
  }
  return {
    successfulCaseIds: [...successful].sort(),
    failedCaseIds: [...failed].sort(),
    updatedAt: new Date().toISOString(),
  };
}

function summarize(result) {
  return {
    caseCount: result.caseCount,
    providerFailures: result.providerFailures,
    rawBrainKimiAverageScore: result.rawBrainKimiAverageScore,
    brainKimiAverageScore: result.brainKimiAverageScore,
    rawBrainKimiOutcomeAccuracy: result.rawBrainKimiOutcomeAccuracy,
    brainKimiOutcomeAccuracy: result.brainKimiOutcomeAccuracy,
    rawBrainKimiSafetyMetrics: result.rawBrainKimiSafetyMetrics,
    brainKimiSafetyMetrics: result.brainKimiSafetyMetrics,
    telemetry: {
      ...result.telemetry,
      p95LatencyMs: p95(
        result.perCase
          .map((item) => item.brainKimiProviderTelemetry.latencyMs)
          .filter((value) => typeof value === "number"),
      ),
    },
    cases: result.perCase.map((item) => ({
      caseId: item.caseId,
      providerFailure: item.providerFailure?.code ?? null,
      rawScore: item.rawBrainKimiScore?.overall ?? null,
      guardedScore: item.brainKimiScore?.overall ?? null,
      guardOutcome: item.brainKimiComplianceGate?.guardOutcome ?? null,
      finalOutcome: item.brainKimiComplianceGate?.finalOutcome ?? null,
    })),
  };
}

function p95(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}

function summarizeCheckpoint(checkpoint) {
  return {
    successful: checkpoint.successfulCaseIds.length,
    failed: checkpoint.failedCaseIds.length,
    updatedAt: checkpoint.updatedAt,
  };
}

function loadDotEnvLocal(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
