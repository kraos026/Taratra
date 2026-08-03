import { describe, expect, it } from "vitest";

import {
  AutomationCandidateQualifier,
  ObservedProcessSequence,
  WorkQualificationReviewService,
  type WorkQualificationContext,
} from "./domain/work-automation-qualification";
import type { AutomationCandidate } from "./domain/work-intelligence";

function candidate(overrides: Partial<AutomationCandidate> = {}): AutomationCandidate {
  return {
    candidateId: "candidate-1",
    tenantId: "tenant-1",
    companyId: "company-1",
    sourceHypothesisId: "work-hypothesis-1",
    sourcePatternIds: ["pattern-1"],
    supportingObservationIds: ["activity-1", "activity-2", "activity-3"],
    score: 82,
    confidence: 90,
    proposedGovernance: "AUTOMATION_WITH_APPROVAL",
    tools: ["system-a", "system-b"],
    requiresHumanApproval: true,
    timeSavingsEstimate: {
      observedTimePerWeekMinutes: 240,
      frequencyDaysPerWeek: 4,
      estimatedAutomatableTimeMinutes: 144,
      estimatedHumanTimeRemainingMinutes: 96,
      confidence: 90,
      assumptions: ["Observed average duration: 60 minutes"],
      provenance: ["activity-1", "activity-2", "activity-3"],
    },
    riskClassification: "MEDIUM",
    explanation: "Repeated current work with significant human judgment",
    provenance: ["activity-1", "pattern-1", "work-hypothesis-1"],
    ...overrides,
  };
}

function sequence(uncertainty: readonly string[] = []) {
  return ObservedProcessSequence.create([
    {
      stepId: "receive-record",
      order: 0,
      observedDescription: "Receive a record",
      observedTools: ["system-a"],
      observedInputs: ["record"],
      observedOutputs: ["received-record"],
      confidence: 95,
      provenance: ["activity-1"],
      uncertainty,
    },
    {
      stepId: "manual-review",
      order: 1,
      observedDescription: "A person reviews and copies fields",
      observedTools: ["system-a", "system-b"],
      observedInputs: ["received-record"],
      observedOutputs: ["reviewed-record"],
      confidence: 85,
      provenance: ["activity-2", "activity-3"],
      uncertainty: [],
    },
  ]);
}

function context(overrides: Partial<WorkQualificationContext> = {}): WorkQualificationContext {
  return {
    observedTrigger: "record received",
    systemIdentitiesConfirmed: true,
    observedOutputsConfirmed: true,
    humanJudgmentConfirmed: true,
    provenance: ["human-confirmation-1"],
    ...overrides,
  };
}

describe("ObservedProcessSequence", () => {
  it("represents current work with evidence only", () => {
    const observed = sequence();
    expect(observed.steps.map((step) => step.observedDescription)).toEqual([
      "Receive a record",
      "A person reviews and copies fields",
    ]);
    expect(JSON.stringify(observed)).not.toMatch(
      /requiredCapability|connector|futureTrigger|automationNode|errorPolicy/,
    );
  });

  it("orders observations deterministically", () => {
    const observed = ObservedProcessSequence.create([...sequence().steps].reverse());
    expect(observed.steps.map((step) => step.order)).toEqual([0, 1]);
  });

  it("requires evidence for every observed step", () => {
    expect(() =>
      ObservedProcessSequence.create([{ ...sequence().steps[0]!, provenance: [] }]),
    ).toThrow("provenance");
  });
});

describe("AutomationCandidate current-work qualification", () => {
  const qualifier = new AutomationCandidateQualifier();

  it("qualifies complete current-work evidence", () => {
    expect(qualifier.assess(candidate(), sequence(), context()).status).toBe("QUALIFIED");
  });

  it("preserves Activity to Pattern to Hypothesis to Candidate provenance", () => {
    const assessment = qualifier.assess(candidate(), sequence(), context());
    expect(assessment.provenance).toEqual(
      expect.arrayContaining(["activity-1", "pattern-1", "work-hypothesis-1", "candidate-1"]),
    );
  });

  it("reports current-work knowledge gaps only", () => {
    const assessment = qualifier.assess(
      candidate(),
      sequence(["order not confirmed"]),
      context({ observedTrigger: null, systemIdentitiesConfirmed: false }),
    );
    expect(assessment.gaps.map((gap) => gap.code)).toEqual(
      expect.arrayContaining([
        "OBSERVED_TRIGGER_UNKNOWN",
        "PROCESS_ORDER_UNCERTAIN",
        "SYSTEM_IDENTITY_UNCERTAIN",
      ]),
    );
    expect(JSON.stringify(assessment.gaps)).not.toMatch(
      /specification|connector choice|deployment/i,
    );
  });

  it("rejects insufficient evidence before qualification", () => {
    const assessment = qualifier.assess(
      candidate({ supportingObservationIds: ["activity-1"] }),
      sequence(),
      context(),
    );
    expect(assessment.status).toBe("NOT_READY");
  });

  it("preserves the proposed governance signal", () => {
    const assessment = qualifier.assess(candidate(), sequence(), context());
    expect(assessment.candidate.proposedGovernance).toBe("AUTOMATION_WITH_APPROVAL");
    expect(assessment.candidate.requiresHumanApproval).toBe(true);
  });

  it("contains no fabricated financial ROI", () => {
    const estimate = qualifier.assess(candidate(), sequence(), context()).candidate
      .timeSavingsEstimate;
    expect(estimate).not.toHaveProperty("financialRoi");
    expect(estimate).not.toHaveProperty("salary");
    expect(estimate).not.toHaveProperty("implementationCost");
  });

  it("lets authoritative human evidence resolve a gap in a new version", () => {
    const assessment = qualifier.assess(
      candidate(),
      sequence(),
      context({ observedTrigger: null }),
    );
    const corrected = new WorkQualificationReviewService().review(
      assessment,
      "SUPPLY_MISSING_INFORMATION",
      "reviewer-1",
      { context: context({ observedTrigger: "confirmed record received" }) },
    );
    expect(corrected).toMatchObject({ version: 2, status: "QUALIFIED" });
    expect(corrected.provenance).toContain("human-review:reviewer-1:SUPPLY_MISSING_INFORMATION");
  });
});
