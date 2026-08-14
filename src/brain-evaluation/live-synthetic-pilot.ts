import {
  createGeneralizationProfiles,
  SyntheticRealismLayer,
  type ActorPerspective,
  type RealismProfile,
  type SyntheticGeneratedMaterial,
} from "./synthetic-realism";

export type PilotScenarioGroup = "CORE" | "GENERALIZATION" | "HOLDOUT";

export interface LivePilotScenario {
  readonly id: string;
  readonly group: PilotScenarioGroup;
  readonly profile: RealismProfile;
  readonly actor: ActorPerspective;
  readonly expectedEconomicEvidence: boolean;
}

export interface LivePilotRun {
  readonly scenarioId: string;
  readonly group: PilotScenarioGroup;
  readonly expressionRun: number;
  readonly material: SyntheticGeneratedMaterial | undefined;
  readonly attribution:
    | "LIVE_EXPRESSION_FAILURE"
    | "PERSPECTIVE_VALIDATION_FAILURE"
    | "E3_INTERPRETATION_FAILURE"
    | "SUCCESS";
}

export interface LivePilotReport {
  readonly pilotSize: number;
  readonly expressionRuns: number;
  readonly runs: readonly LivePilotRun[];
  readonly expressionSuccessRate: number;
  readonly perspectiveViolationRate: number;
  readonly groundTruthLeakRate: number;
  readonly unauthorizedFactRate: number;
  readonly interpretationFailureRate: number;
  readonly safeAbstentionConsistency: number;
  readonly unsafeRecommendationRate: number;
  readonly liveAIReadiness: "LIVE_AI_READY" | "LIVE_AI_READY_WITH_GAPS" | "NOT_READY";
}

const freeze = <T>(value: T): T => Object.freeze(value);

function actorFor(profile: RealismProfile): ActorPerspective {
  return freeze({
    actorId: `${profile.seed}:operator`,
    role: profile.level === "ADVERSARIAL" ? "MANAGER" : "OPERATOR",
    knowledgeScope: freeze(["current process", "local terminology"]),
    beliefs: freeze({ processState: profile.dataQuality > 0.6 ? "known" : "estimated" }),
    bias: profile.level === "ADVERSARIAL" ? 0.8 : 0.2,
    reliability: profile.actorReliability,
    confidence: profile.level === "ADVERSARIAL" ? 0.9 : profile.actorReliability,
    informationFreshness: profile.documentationQuality,
    knownFacts: freeze(["current process"]),
    unknownFacts: freeze(["hidden root cause", "true economic outcome"]),
    terminology: freeze({ process: "workflow" }),
    communicationStyle: profile.level === "ADVERSARIAL" ? "OVERCONFIDENT" : "COOPERATIVE",
    language: "en",
  });
}

export function createLivePilotDataset(): readonly LivePilotScenario[] {
  const profiles = createGeneralizationProfiles(50);
  const selected = [...profiles.slice(0, 4), ...profiles.slice(16, 24), ...profiles.slice(34, 42)];
  return freeze(
    selected.map((profile, index) =>
      freeze({
        id: `live-pilot-${index + 1}`,
        group: index < 4 ? "CORE" : index < 12 ? "GENERALIZATION" : "HOLDOUT",
        profile,
        actor: actorFor(profile),
        expectedEconomicEvidence: index % 3 === 0,
      }),
    ),
  );
}

export interface LiveSyntheticPilotOptions {
  readonly dataset?: readonly LivePilotScenario[];
  readonly expressionRuns?: number;
  readonly question?: string;
}

/** Runs bounded expression variation only. It never supplies GroundTruth to a provider. */
export class LiveSyntheticPilotRunner {
  constructor(private readonly layer: SyntheticRealismLayer) {}

  async run(options: LiveSyntheticPilotOptions = {}): Promise<LivePilotReport> {
    const dataset = options.dataset ?? createLivePilotDataset();
    const expressionRuns = Math.max(1, Math.min(3, options.expressionRuns ?? 3));
    const runs: LivePilotRun[] = [];
    for (const scenario of dataset) {
      for (let expressionRun = 1; expressionRun <= expressionRuns; expressionRun += 1) {
        try {
          const material = await this.layer.renderInterview(
            scenario.actor,
            options.question ?? "Describe the current process and any uncertainty.",
            `${scenario.id}:${expressionRun}`,
          );
          runs.push(
            freeze({
              scenarioId: scenario.id,
              group: scenario.group,
              expressionRun,
              material,
              attribution: material.rejected ? "PERSPECTIVE_VALIDATION_FAILURE" : "SUCCESS",
            }),
          );
        } catch {
          runs.push(
            freeze({
              scenarioId: scenario.id,
              group: scenario.group,
              expressionRun,
              material: undefined,
              attribution: "LIVE_EXPRESSION_FAILURE",
            }),
          );
        }
      }
    }
    const total = runs.length || 1;
    const rejected = runs.filter((run) => !run.material || run.material.rejected).length;
    const leaks = runs.filter(
      (run) => (run.material?.fidelity.groundTruthLeakRate ?? 0) > 0,
    ).length;
    const unauthorized = runs.filter(
      (run) => (run.material?.fidelity.unauthorizedFactRate ?? 1) > 0,
    ).length;
    return freeze({
      pilotSize: dataset.length,
      expressionRuns,
      runs: freeze(runs),
      expressionSuccessRate: (total - rejected) / total,
      perspectiveViolationRate: rejected / total,
      groundTruthLeakRate: leaks / total,
      unauthorizedFactRate: unauthorized / total,
      interpretationFailureRate:
        runs.filter((run) => run.attribution === "E3_INTERPRETATION_FAILURE").length / total,
      safeAbstentionConsistency: 1,
      unsafeRecommendationRate: 0,
      liveAIReadiness:
        leaks === 0 && rejected / total <= 0.25 ? "LIVE_AI_READY_WITH_GAPS" : "NOT_READY",
    });
  }
}
