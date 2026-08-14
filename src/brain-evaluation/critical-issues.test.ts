import { describe, expect, it } from "vitest";
import { CriticalIssueDetector } from "./critical-issues";
import { BottleneckSignalModel, ProcessStep } from "./process-causal";

describe("C2 bottleneck and critical issue intelligence", () => {
  it("derives deterministic queue and capacity signals", () => {
    const step = ProcessStep.create({
      stepId: "queue",
      name: "Queue",
      processingMinutes: 5,
      waitingMinutes: 30,
      queueDepth: 20,
      arrivalRate: 20,
      serviceCapacity: 10,
    });
    const signals = new BottleneckSignalModel().signals(step);
    expect(signals.map((signal) => signal.family)).toEqual([
      "WAITING_TIME",
      "QUEUE_ACCUMULATION",
      "CAPACITY_MISMATCH",
      "HIGH_UTILIZATION",
    ]);
    expect(signals).toEqual(new BottleneckSignalModel().signals(step));
  });
  it("preserves mandatory controls while reporting their risk", () => {
    const issues = new CriticalIssueDetector().detect({
      causes: [],
      bottlenecks: [],
      mandatoryControlSubjects: ["approve"],
    });
    expect(issues[0]?.issueType).toBe("MANDATORY_CONTROL_RISK");
    expect(issues[0]?.blockingDecision).toBe(true);
  });
  it("returns unresolved critical unknowns instead of inventing a bottleneck", () => {
    const issues = new CriticalIssueDetector().detect({
      causes: [],
      bottlenecks: [],
      unknowns: [
        {
          unknownId: "unknown:capacity",
          missingField: "capacity",
          domain: "process",
          reason: "not measured",
          impact: "cannot assess",
          requiredFor: ["decision"],
          priority: "CRITICAL",
          suggestedClarification: "What is capacity?",
        },
      ],
    });
    expect(issues[0]?.issueType).toBe("UNRESOLVED_CRITICAL_UNKNOWN");
  });
});
