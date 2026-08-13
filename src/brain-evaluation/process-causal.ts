import { Claim, Evidence, ReasoningTrace, type UnknownInformation } from "./brain-contracts";
import { InformationGapDetector, type BrainDiscoveryState } from "./adaptive-discovery";

export type ProcessStepKind = "MANUAL" | "AUTOMATED" | "DECISION";
export type DependencyKind = "STEP" | "SYSTEM" | "DATA" | "ROLE" | "APPROVAL" | "PREREQUISITE";
export type CausalRelationshipKind = "DIRECT" | "INDIRECT" | "CORRELATION";
export type CauseKind = "ROOT" | "CONTRIBUTING" | "CANDIDATE";
export type ProcessConclusionKind =
  "OBSERVATION" | "SYMPTOM" | "CAUSE" | "BOTTLENECK" | "HANDOFF" | "REWORK" | "FAILURE_MODE";

const freeze = <T extends object>(value: T): T => Object.freeze(value);
const strings = (values: readonly string[]) => Object.freeze([...values]);
const required = (value: string, label: string) => {
  if (!value.trim()) throw new Error(`${label} is required`);
  return value;
};

export interface ProcessStepInput {
  stepId: string;
  name: string;
  actor?: string;
  system?: string;
  kind?: ProcessStepKind;
  processingMinutes?: number;
  waitingMinutes?: number;
  input?: string;
  output?: string;
  errorRate?: number;
  reworkRate?: number;
  volume?: number;
  decisionPoint?: boolean;
  exceptionFrequency?: number;
}
export class ProcessStep {
  readonly stepId: string;
  readonly name: string;
  readonly actor: string | null;
  readonly system: string | null;
  readonly kind: ProcessStepKind;
  readonly processingMinutes: number;
  readonly waitingMinutes: number;
  readonly input: string | null;
  readonly output: string | null;
  readonly errorRate: number;
  readonly reworkRate: number;
  readonly volume: number;
  readonly decisionPoint: boolean;
  readonly exceptionFrequency: number;
  private constructor(input: ProcessStepInput) {
    this.stepId = required(input.stepId, "stepId");
    this.name = required(input.name, "step name");
    this.actor = input.actor?.trim() || null;
    this.system = input.system?.trim() || null;
    this.kind = input.kind ?? "MANUAL";
    this.processingMinutes = nonNegative(input.processingMinutes ?? 0, "processingMinutes");
    this.waitingMinutes = nonNegative(input.waitingMinutes ?? 0, "waitingMinutes");
    this.input = input.input?.trim() || null;
    this.output = input.output?.trim() || null;
    this.errorRate = ratio(input.errorRate ?? 0, "errorRate");
    this.reworkRate = ratio(input.reworkRate ?? 0, "reworkRate");
    this.volume = nonNegative(input.volume ?? 0, "volume");
    this.decisionPoint = input.decisionPoint ?? false;
    this.exceptionFrequency = ratio(input.exceptionFrequency ?? 0, "exceptionFrequency");
    freeze(this);
  }
  static create(input: ProcessStepInput) {
    return new ProcessStep(input);
  }
}
export interface ProcessInput {
  processId: string;
  name: string;
  steps: readonly ProcessStep[];
}
export class Process {
  readonly processId: string;
  readonly name: string;
  readonly steps: readonly ProcessStep[];
  private constructor(input: ProcessInput) {
    this.processId = required(input.processId, "processId");
    this.name = required(input.name, "process name");
    this.steps = Object.freeze([...input.steps]);
    freeze(this);
  }
  static create(input: ProcessInput) {
    return new Process(input);
  }
}
export interface HandoffInput {
  handoffId: string;
  fromStepId: string;
  toStepId: string;
  fromSystem?: string;
  toSystem?: string;
  ownerAmbiguous?: boolean;
  contextLoss?: boolean;
  confirmationCount?: number;
  delayedApproval?: boolean;
  channel?: string;
  evidenceIds?: readonly string[];
}
export class Handoff {
  readonly handoffId: string;
  readonly fromStepId: string;
  readonly toStepId: string;
  readonly fromSystem: string | null;
  readonly toSystem: string | null;
  readonly ownerAmbiguous: boolean;
  readonly contextLoss: boolean;
  readonly confirmationCount: number;
  readonly delayedApproval: boolean;
  readonly channel: string | null;
  readonly evidenceIds: readonly string[];
  private constructor(i: HandoffInput) {
    this.handoffId = required(i.handoffId, "handoffId");
    this.fromStepId = required(i.fromStepId, "fromStepId");
    this.toStepId = required(i.toStepId, "toStepId");
    this.fromSystem = i.fromSystem?.trim() || null;
    this.toSystem = i.toSystem?.trim() || null;
    this.ownerAmbiguous = i.ownerAmbiguous ?? false;
    this.contextLoss = i.contextLoss ?? false;
    this.confirmationCount = nonNegative(i.confirmationCount ?? 0, "confirmationCount");
    this.delayedApproval = i.delayedApproval ?? false;
    this.channel = i.channel?.trim() || null;
    this.evidenceIds = strings(i.evidenceIds ?? []);
    freeze(this);
  }
  static create(i: HandoffInput) {
    return new Handoff(i);
  }
}
export interface DependencyInput {
  dependencyId: string;
  kind: DependencyKind;
  fromId: string;
  toId: string;
  required?: boolean;
}
export class Dependency {
  readonly dependencyId: string;
  readonly kind: DependencyKind;
  readonly fromId: string;
  readonly toId: string;
  readonly required: boolean;
  private constructor(i: DependencyInput) {
    this.dependencyId = required(i.dependencyId, "dependencyId");
    this.kind = i.kind;
    this.fromId = required(i.fromId, "fromId");
    this.toId = required(i.toId, "toId");
    this.required = i.required ?? true;
    freeze(this);
  }
  static create(i: DependencyInput) {
    return new Dependency(i);
  }
}
export interface ControlPointInput {
  controlId: string;
  stepId: string;
  type:
    | "APPROVAL"
    | "VALIDATION"
    | "RECONCILIATION"
    | "ACCESS_CHECK"
    | "THRESHOLD_CHECK"
    | "QUALITY_REVIEW";
  requiredHuman?: boolean;
  intentional?: boolean;
}
export class ControlPoint {
  readonly controlId: string;
  readonly stepId: string;
  readonly type: ControlPointInput["type"];
  readonly requiredHuman: boolean;
  readonly intentional: boolean;
  private constructor(i: ControlPointInput) {
    this.controlId = required(i.controlId, "controlId");
    this.stepId = required(i.stepId, "stepId");
    this.type = i.type;
    this.requiredHuman = i.requiredHuman ?? false;
    this.intentional = i.intentional ?? false;
    freeze(this);
  }
  static create(i: ControlPointInput) {
    return new ControlPoint(i);
  }
}
export interface ProcessModelInput {
  process: Process;
  handoffs?: readonly Handoff[];
  dependencies?: readonly Dependency[];
  controls?: readonly ControlPoint[];
}
export class ProcessModel {
  readonly process: Process;
  readonly handoffs: readonly Handoff[];
  readonly dependencies: readonly Dependency[];
  readonly controls: readonly ControlPoint[];
  private constructor(i: ProcessModelInput) {
    this.process = i.process;
    this.handoffs = Object.freeze([...(i.handoffs ?? [])]);
    this.dependencies = Object.freeze([...(i.dependencies ?? [])]);
    this.controls = Object.freeze([...(i.controls ?? [])]);
    freeze(this);
  }
  static create(i: ProcessModelInput) {
    return new ProcessModel(i);
  }
}

export interface ProcessObservation {
  observationId: string;
  statement: string;
  stepIds: readonly string[];
  evidenceIds: readonly string[];
  inferred: boolean;
}
export interface Symptom {
  symptomId: string;
  type: string;
  statement: string;
  stepIds: readonly string[];
  supportingClaimIds: readonly string[];
  supportingEvidenceIds: readonly string[];
  impact: number;
}
export interface CauseCandidate {
  causeId: string;
  kind: CauseKind;
  statement: string;
  affectedStepIds: readonly string[];
  supportingClaimIds: readonly string[];
  supportingEvidenceIds: readonly string[];
  confidence: number;
  relationship: CausalRelationshipKind;
  competingCauseIds: readonly string[];
  unresolvedUnknownIds: readonly string[];
  trace: ReasoningTrace;
}
export interface CausalLink {
  causeId: string;
  effectId: string;
  relationship: CausalRelationshipKind;
  supportingClaimIds: readonly string[];
  confidence: number;
  causalStrength: number;
  competingExplanations: readonly string[];
  unresolvedUnknowns: readonly string[];
}
export interface Bottleneck {
  bottleneckId: string;
  stepId: string;
  reason: string;
  evidenceIds: readonly string[];
  confidence: number;
  impact: number;
  observed: boolean;
}
export interface FailureMode {
  failureModeId: string;
  type: string;
  stepId: string;
  evidenceIds: readonly string[];
  probability: number;
  impact: number;
  controlIds: readonly string[];
  detection: string;
  unresolvedUnknownIds: readonly string[];
}
export interface ProcessConclusion {
  kind: ProcessConclusionKind;
  id: string;
  statement: string;
  confidence: number;
  evidenceIds: readonly string[];
  stepIds: readonly string[];
  observed: boolean;
}

export class CausalReasoner {
  reason(
    model: ProcessModel,
    claims: readonly Claim[],
    evidence: readonly Evidence[],
    unknowns: readonly UnknownInformation[] = [],
  ): readonly CauseCandidate[] {
    const results: CauseCandidate[] = [];
    for (const step of model.process.steps) {
      const related = evidence.filter(
        (e) =>
          e.tags.includes(step.stepId) || e.content.toLowerCase().includes(step.name.toLowerCase()),
      );
      const competing =
        step.system && step.input
          ? claims
              .filter((c) => c.statement.toLowerCase().includes(step.system!.toLowerCase()))
              .map((c) => c.claimId)
          : [];
      const confidence = round(
        Math.max(
          0,
          Math.min(
            1,
            related.length
              ? related.reduce((s, e) => s + e.reliability, 0) / related.length -
                  (competing.length > 1 ? 0.2 : 0)
              : 0,
          ),
        ),
      );
      results.push({
        causeId: `cause:${step.stepId}`,
        kind: "CANDIDATE",
        statement: step.input
          ? `Missing or delayed input may affect ${step.name}`
          : `${step.name} may be a contributing cause`,
        affectedStepIds: [step.stepId],
        supportingClaimIds: claims
          .filter((c) =>
            c.supportingEvidenceIds.some((id) => related.some((e) => e.evidenceId === id)),
          )
          .map((c) => c.claimId),
        supportingEvidenceIds: related.map((e) => e.evidenceId),
        confidence,
        relationship: confidence < 0.6 ? "CORRELATION" : "INDIRECT",
        competingCauseIds: competing,
        unresolvedUnknownIds: unknowns
          .filter((u) => u.domain === step.stepId)
          .map((u) => u.unknownId),
        trace: ReasoningTrace.create(
          { [step.stepId]: step.name, [`cause:${step.stepId}`]: "Cause candidate" },
          [
            {
              fromId: step.stepId,
              toId: `cause:${step.stepId}`,
              relationship: "supports",
              rationale: "Process structure and available evidence",
            },
          ],
        ),
      });
    }
    return Object.freeze(results);
  }
}
export class BottleneckDetector {
  detect(model: ProcessModel): readonly Bottleneck[] {
    return Object.freeze(
      model.process.steps
        .filter(
          (s) =>
            s.waitingMinutes > s.processingMinutes * 2 ||
            s.reworkRate >= 0.3 ||
            s.exceptionFrequency >= 0.3 ||
            s.volume >= 100,
        )
        .map((s): Bottleneck => ({
          bottleneckId: `bottleneck:${s.stepId}`,
          stepId: s.stepId,
          reason:
            s.waitingMinutes > s.processingMinutes * 2
              ? "Waiting time materially exceeds processing time"
              : s.reworkRate >= 0.3
                ? "High rework rate"
                : s.exceptionFrequency >= 0.3
                  ? "High exception frequency"
                  : "Capacity pressure",
          evidenceIds: [],
          confidence: 0.7,
          impact: round(
            Math.min(
              1,
              (s.waitingMinutes / (s.processingMinutes + 1)) * 0.2 +
                s.reworkRate * 0.4 +
                s.exceptionFrequency * 0.4,
            ),
          ),
          observed: true,
        })),
    );
  }
}
export class HandoffAnalyzer {
  analyze(model: ProcessModel): readonly ProcessConclusion[] {
    const out: ProcessConclusion[] = [];
    for (const h of model.handoffs) {
      const risks = [
        h.ownerAmbiguous && "ownership ambiguity",
        h.contextLoss && "loss of context",
        h.confirmationCount > 1 && "repeated confirmation",
        h.delayedApproval && "delayed approval",
        h.fromSystem !== h.toSystem && "manual transcription/incompatible systems",
      ].filter(Boolean) as string[];
      if (risks.length)
        out.push({
          kind: "HANDOFF",
          id: h.handoffId,
          statement: risks.join(", "),
          confidence: 0.8,
          evidenceIds: h.evidenceIds,
          stepIds: [h.fromStepId, h.toStepId],
          observed: true,
        });
    }
    return Object.freeze(out);
  }
}
export class ReworkAnalyzer {
  analyze(model: ProcessModel): readonly ProcessConclusion[] {
    return Object.freeze(
      model.process.steps
        .filter((s) => s.reworkRate > 0 || s.errorRate > 0)
        .map((s): ProcessConclusion => ({
          kind: "REWORK",
          id: `rework:${s.stepId}`,
          statement:
            s.reworkRate > 0
              ? "Repeated correction/rework loop"
              : "Validation errors may propagate",
          confidence: round(Math.max(s.reworkRate, s.errorRate)),
          evidenceIds: [],
          stepIds: [s.stepId],
          observed: true,
        })),
    );
  }
}
export class RootCauseGuard {
  evaluate(
    cause: CauseCandidate,
    contradictions: number,
    criticalUnknowns: number,
  ): CauseCandidate {
    const blocked =
      contradictions > 0 || criticalUnknowns > 0 || cause.relationship === "CORRELATION";
    return { ...cause, confidence: blocked ? Math.min(cause.confidence, 0.49) : cause.confidence };
  }
}
export class ProcessDependencyGraph {
  readonly nodes: readonly string[];
  readonly edges: readonly Dependency[];
  constructor(model: ProcessModel) {
    this.nodes = Object.freeze(model.process.steps.map((s) => s.stepId));
    this.edges = Object.freeze(
      [...model.dependencies].sort((a, b) => a.dependencyId.localeCompare(b.dependencyId)),
    );
  }
  dependenciesFrom(id: string) {
    return this.edges.filter((e) => e.fromId === id);
  }
}
export class FailureModeAnalyzer {
  analyze(model: ProcessModel): readonly FailureMode[] {
    return Object.freeze(
      model.process.steps
        .filter((s) => s.errorRate > 0 || s.exceptionFrequency > 0)
        .map((s) => ({
          failureModeId: `failure:${s.stepId}`,
          type: s.errorRate >= s.exceptionFrequency ? "INVALID_DATA" : "EXCEPTION",
          stepId: s.stepId,
          evidenceIds: [],
          probability: Math.max(s.errorRate, s.exceptionFrequency),
          impact: Math.min(1, (s.errorRate + s.exceptionFrequency) / 2),
          controlIds: model.controls.filter((c) => c.stepId === s.stepId).map((c) => c.controlId),
          detection: "Process metric or control review",
          unresolvedUnknownIds: [],
        })),
    );
  }
}
export class ProcessObservationService {
  observe(model: ProcessModel, evidence: readonly Evidence[]): readonly ProcessObservation[] {
    return Object.freeze(
      model.process.steps
        .filter((s) => evidence.some((e) => e.tags.includes(s.stepId)))
        .map((s) => ({
          observationId: `observation:${s.stepId}`,
          statement: `Observed activity at ${s.name}`,
          stepIds: [s.stepId],
          evidenceIds: evidence.filter((e) => e.tags.includes(s.stepId)).map((e) => e.evidenceId),
          inferred: false,
        })),
    );
  }
}
export class CausalDiscoveryBridge {
  constructor(private readonly gaps = new InformationGapDetector()) {}
  discover(state: BrainDiscoveryState) {
    return this.gaps.detect(state);
  }
}
function nonNegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be non-negative`);
  return value;
}
function ratio(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || value > 1)
    throw new Error(`${label} must be between 0 and 1`);
  return value;
}
function round(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
