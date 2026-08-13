import { describe, expect, it } from "vitest";
import { Evidence } from "./brain-contracts";
import {
  BottleneckDetector,
  CausalReasoner,
  Handoff,
  HandoffAnalyzer,
  Process,
  ProcessDependencyGraph,
  ProcessModel,
  ProcessObservationService,
  ProcessStep,
  ReworkAnalyzer,
  RootCauseGuard,
  FailureModeAnalyzer,
  ControlPoint,
  Dependency,
} from "./process-causal";

const evidence = (id: string, tags: string[], content = "Observed process fact") =>
  Evidence.create({
    evidenceId: id,
    sourceType: "OBSERVED",
    sourceReference: id,
    sourceModule: "brain_evaluation",
    capturedAt: new Date("2026-01-01T00:00:00Z"),
    freshness: "CURRENT",
    reliability: 0.9,
    content,
    provenance: {},
    tags,
  });
const model = () =>
  ProcessModel.create({
    process: Process.create({
      processId: "orders",
      name: "Order processing",
      steps: [
        ProcessStep.create({
          stepId: "copy",
          name: "Copy order",
          actor: "operator",
          system: "ERP",
          processingMinutes: 5,
          waitingMinutes: 240,
          reworkRate: 0.4,
          errorRate: 0.2,
          volume: 10,
        }),
        ProcessStep.create({
          stepId: "approve",
          name: "Approve order",
          processingMinutes: 5,
          waitingMinutes: 5,
          decisionPoint: true,
        }),
      ],
    }),
    handoffs: [
      Handoff.create({
        handoffId: "h1",
        fromStepId: "copy",
        toStepId: "approve",
        fromSystem: "Shop",
        toSystem: "ERP",
        contextLoss: true,
        confirmationCount: 2,
        evidenceIds: ["e1"],
      }),
    ],
    dependencies: [
      Dependency.create({ dependencyId: "d1", kind: "STEP", fromId: "copy", toId: "approve" }),
    ],
    controls: [
      ControlPoint.create({
        controlId: "c1",
        stepId: "approve",
        type: "APPROVAL",
        intentional: true,
        requiredHuman: true,
      }),
    ],
  });

describe("B2.4 process and causal intelligence", () => {
  it("keeps process facts separate from inferred conclusions", () => {
    const m = model();
    const observations = new ProcessObservationService().observe(m, [evidence("e1", ["copy"])]);
    expect(observations[0]?.inferred).toBe(false);
    expect(new HandoffAnalyzer().analyze(m)[0]?.kind).toBe("HANDOFF");
  });
  it("detects waiting bottlenecks deterministically", () => {
    const m = model();
    const detector = new BottleneckDetector();
    expect(detector.detect(m)).toEqual(detector.detect(m));
    expect(detector.detect(m).map((x) => x.stepId)).toContain("copy");
  });
  it("detects rework and failure signals without assuming a cause", () => {
    const m = model();
    expect(new ReworkAnalyzer().analyze(m)[0]?.kind).toBe("REWORK");
    expect(new FailureModeAnalyzer().analyze(m)[0]?.stepId).toBe("copy");
  });
  it("produces reproducible dependency graph", () => {
    const graph = new ProcessDependencyGraph(model());
    expect(graph.dependenciesFrom("copy")[0]?.toId).toBe("approve");
  });
  it("guards correlation or unresolved material alternatives", () => {
    const cause = new CausalReasoner().reason(model(), [], [evidence("e1", ["copy"])])[0]!;
    expect(new RootCauseGuard().evaluate(cause, 1, 0).confidence).toBeLessThan(0.5);
  });
  it("preserves intentional human controls", () => {
    const control = model().controls[0]!;
    expect(control.intentional).toBe(true);
    expect(control.requiredHuman).toBe(true);
    const controlled = Process.create({
      processId: "approval",
      name: "Approval",
      steps: [model().process.steps[1]!],
    });
    expect(
      new BottleneckDetector().detect(
        ProcessModel.create({ process: controlled, controls: [control] }),
      ),
    ).toEqual([]);
  });
  it("rejects invalid process metrics", () => {
    expect(() => ProcessStep.create({ stepId: "x", name: "x", errorRate: 2 })).toThrow();
  });
});
