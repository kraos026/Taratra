import { describe, expect, it } from "vitest";
import type { AIInterpretationResult } from "./ai-interpretation-gateway";
import {
  InMemoryLiveAITransport,
  LiveSyntheticAIProvider,
  readLiveSyntheticAIConfig,
} from "./live-synthetic-ai";
import { createLivePilotDataset, LiveSyntheticPilotRunner } from "./live-synthetic-pilot";
import { DeterministicSyntheticTextProvider, SyntheticRealismLayer } from "./synthetic-realism";

describe("E5.2 live pilot contracts", () => {
  it("selects a fixed 20-scenario dataset with holdout separation", () => {
    const dataset = createLivePilotDataset();
    expect(dataset).toHaveLength(20);
    expect(dataset.filter((item) => item.group === "CORE")).toHaveLength(4);
    expect(dataset.filter((item) => item.group === "GENERALIZATION")).toHaveLength(8);
    expect(dataset.filter((item) => item.group === "HOLDOUT")).toHaveLength(8);
    expect(dataset[0]?.actor.unknownFacts).toContain("hidden root cause");
  });

  it("keeps the deterministic fallback offline", async () => {
    const report = await new LiveSyntheticPilotRunner(
      new SyntheticRealismLayer({
        level: "REALISTIC",
        promptVersion: "1",
        provider: new DeterministicSyntheticTextProvider(),
      }),
    ).run({ expressionRuns: 1 });
    expect(report.pilotSize).toBe(20);
    expect(report.groundTruthLeakRate).toBe(0);
    expect(report.runs.every((run) => run.material?.provenance === "SYNTHETIC")).toBe(true);
  });

  it("supports a fake live transport without network access", async () => {
    const fake: AIInterpretationResult = {
      requestId: "synthetic-interview:live-pilot-1:operator:r-1",
      provider: "fake",
      model: "fake",
      task: "PROCESS_OBSERVATION",
      schemaVersion: "synthetic-realism-v1",
      candidates: [],
      sourceReferences: [],
      warnings: [],
      validationIssues: [],
      createdAt: new Date("2026-01-01T00:00:00Z"),
    };
    const provider = new LiveSyntheticAIProvider(
      new InMemoryLiveAITransport(() => ({ result: fake })),
      readLiveSyntheticAIConfig({
        AUTOMATEX_LIVE_SYNTHETIC_AI: "true",
        AUTOMATEX_AI_MODEL: "fake",
      }),
    );
    await expect(
      provider.interpret({
        requestId: fake.requestId,
        tenantId: "synthetic",
        sourceId: "synthetic-interview:live-pilot-1:operator-r-1",
        sourceType: "INTERVIEW",
        sourceText: "current process",
        task: "PROCESS_OBSERVATION",
        schemaVersion: "synthetic-realism-v1",
      }),
    ).resolves.toBeDefined();
  });
});
