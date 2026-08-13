import { describe, expect, it } from "vitest";

import {
  AdaptiveInterviewPlanner,
  DiscoveryStoppingCriteria,
  InformationGapDetector,
  QuestionValueEstimator,
} from "./adaptive-discovery";
import {
  budgetExhaustedState,
  criticalContradictionState,
  missingRoiVolumeState,
  multipleGapsState,
  nonMaterialUnknownState,
  objectiveEvidencePreferredState,
  redundantQuestionState,
} from "./adaptive-discovery-scenarios";

describe("B2.3 Adaptive Discovery & Interview Intelligence", () => {
  it("selects the same next question for the same Brain state", () => {
    const planner = new AdaptiveInterviewPlanner();

    expect(planner.plan(missingRoiVolumeState).selectedAction).toEqual(
      planner.plan(missingRoiVolumeState).selectedAction,
    );
  });

  it("asks for quantitative/system evidence before ROI when volume is missing", () => {
    const result = new AdaptiveInterviewPlanner().plan(missingRoiVolumeState);

    expect(result.selectedAction).toMatchObject({
      questionType: "SYSTEM_DATA_REQUEST",
      requiredEvidenceType: "METRIC",
      respondentRole: "system data",
      blocking: true,
    });
    expect(result.selectedAction?.question).toContain("transactionVolume");
  });

  it("lets a material ROI gap outrank a minor finding gap", () => {
    const result = new AdaptiveInterviewPlanner().plan(multipleGapsState);

    expect(result.selectedAction?.targetGapIds[0]).toBe("gap:unknown:error-rate");
    expect(result.selectedAction?.priority).toBe("HIGH");
  });

  it("prefers objective evidence over subjective re-questioning", () => {
    const result = new AdaptiveInterviewPlanner().plan(objectiveEvidencePreferredState);

    expect(result.selectedAction?.questionType).toBe("SYSTEM_DATA_REQUEST");
    expect(result.selectedAction?.rationale).toContain("Objective operational evidence");
  });

  it("avoids duplicate questions and resolved gaps", () => {
    const planner = new AdaptiveInterviewPlanner();
    const first = planner.plan(missingRoiVolumeState).selectedAction!;
    const second = planner.plan({
      ...missingRoiVolumeState,
      budget: {
        ...missingRoiVolumeState.budget,
        alreadyAskedQuestionIds: [first.questionId],
      },
    });

    expect(second.selectedAction?.questionId).not.toBe(first.questionId);
    expect(new InformationGapDetector().detect(redundantQuestionState)).toHaveLength(0);
  });

  it("blocks readiness for critical contradictions and prioritizes system data", () => {
    const result = new AdaptiveInterviewPlanner().plan(criticalContradictionState);

    expect(result.readiness.outcome).toBe("BLOCKED_BY_CRITICAL_GAPS");
    expect(result.candidates[0]).toMatchObject({
      questionType: "SYSTEM_DATA_REQUEST",
      requiredEvidenceType: "METRIC",
      priority: "CRITICAL",
    });
  });

  it("does not force endless discovery for non-material unknowns", () => {
    const result = new AdaptiveInterviewPlanner().plan(nonMaterialUnknownState);

    expect(result.readiness.outcome).toBe("READY_WITH_DECLARED_UNCERTAINTY");
    expect(result.selectedAction).toBeNull();
    expect(result.readiness.declaredUncertaintyGapIds).toEqual(["gap:unknown:minor-label"]);
  });

  it("respects interview budget exhaustion", () => {
    const result = new AdaptiveInterviewPlanner().plan(budgetExhaustedState);

    expect(result.selectedAction).toBeNull();
    expect(result.readiness.outcome).toBe("BLOCKED_BY_CRITICAL_GAPS");
    expect(result.readiness.rationale).toContain("budget");
  });

  it("computes reproducible expectedInformationGain", () => {
    const gap = new InformationGapDetector().detect(multipleGapsState)[0]!;
    const estimator = new QuestionValueEstimator();

    expect(
      estimator.estimate({
        gap,
        evidence: multipleGapsState.evidence,
        candidateQuestionType: "SYSTEM_DATA_REQUEST",
      }),
    ).toEqual(
      estimator.estimate({
        gap,
        evidence: multipleGapsState.evidence,
        candidateQuestionType: "SYSTEM_DATA_REQUEST",
      }),
    );
  });

  it("has deterministic stopping criteria", () => {
    const detector = new InformationGapDetector();
    const gaps = detector.detect(nonMaterialUnknownState);
    const criteria = new DiscoveryStoppingCriteria();

    expect(criteria.evaluate({ ...nonMaterialUnknownState, gaps, candidates: [] })).toEqual(
      criteria.evaluate({ ...nonMaterialUnknownState, gaps, candidates: [] }),
    );
  });

  it("integrates trace links explaining why questions are asked", () => {
    const result = new AdaptiveInterviewPlanner().plan(missingRoiVolumeState);

    expect(result.trace.forward("gap:unknown:roi-volume")).toHaveLength(1);
    expect(result.trace.backward(`readiness:${result.readiness.outcome}`)).toHaveLength(1);
  });
});
