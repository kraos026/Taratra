import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

import { runCanonicalShadowBenchmark } from "../src/brain-evaluation/canonical-shadow-benchmark.ts";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "..");
const outputDir = join(repoRoot, "artifacts", "brain-benchmark");
const args = process.argv.slice(2);
const caseIds = readCaseIds(args);
const codeSha = execSync("git rev-parse HEAD", { cwd: repoRoot, encoding: "utf8" }).trim();
const result = runCanonicalShadowBenchmark({ caseIds, codeSha });

mkdirSync(outputDir, { recursive: true });
writeFileSync(
  join(outputDir, "benchmark-summary.json"),
  `${JSON.stringify(summarize(result), null, 2)}\n`,
);
for (const caseResult of result.perCase) {
  writeFileSync(
    join(outputDir, `${artifactName(caseResult.caseId)}.json`),
    `${JSON.stringify(caseResult, null, 2)}\n`,
  );
}

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

function summarize(result) {
  return {
    codeSha: result.codeSha,
    benchmarkVersion: result.benchmarkVersion,
    caseCount: result.caseCount,
    canonicalAverageScore: result.canonicalAverageScore,
    brainOnlyAverageScore: result.brainOnlyAverageScore,
    hybridAverageScore: result.hybridAverageScore,
    brainOnlyUsefulAdditionRate: result.brainOnlyUsefulAdditionRate,
    hybridUsefulAdditionRate: result.hybridUsefulAdditionRate,
    brainOnlyFalsePositiveRate: result.brainOnlyFalsePositiveRate,
    hybridFalsePositiveRate: result.hybridFalsePositiveRate,
    brainOnlyCriticalHallucinations: result.brainOnlyCriticalHallucinations,
    hybridCriticalHallucinations: result.hybridCriticalHallucinations,
    brainOnlyUnsupportedRoiClaims: result.brainOnlyUnsupportedRoiClaims,
    hybridUnsupportedRoiClaims: result.hybridUnsupportedRoiClaims,
    brainOnlyDivergenceCounts: result.brainOnlyDivergenceCounts,
    hybridDivergenceCounts: result.hybridDivergenceCounts,
    promotionEligible: result.promotionEligible,
    promotionRationale: result.promotionRationale,
    cases: result.perCase.map((item) => ({
      caseId: item.caseId,
      canonicalScore: item.canonicalScore.overall,
      brainOnlyScore: item.brainOnlyScore.overall,
      hybridScore: item.hybridScore.overall,
      brainOnlyDelta: item.brainOnlyDelta,
      hybridDelta: item.hybridDelta,
      winner: item.winner,
      brainOnlyIncrementalValue: item.brainOnlyIncrementalValue,
      hybridIncrementalValue: item.hybridIncrementalValue,
      brainOnlyDivergences: item.brainOnlyDivergences.map((divergence) => divergence.type),
      hybridDivergences: item.hybridDivergences.map((divergence) => divergence.type),
    })),
  };
}

function artifactName(caseId) {
  return `case-${caseId.replaceAll("_", "-")}`;
}
