import { Claim, Evidence, ReasoningTrace, type UnknownInformation } from "./brain-contracts";
import { InformationGapDetector, type BrainDiscoveryState } from "./adaptive-discovery";

export type ProcessStepKind = "MANUAL" | "AUTOMATED" | "DECISION";
export type DependencyKind = "STEP" | "SYSTEM" | "DATA" | "ROLE" | "APPROVAL" | "PREREQUISITE";
export type CausalRelationshipKind = "DIRECT" | "INDIRECT" | "CORRELATION";
export type CauseKind = "ROOT" | "CONTRIBUTING" | "SYMPTOM" | "CANDIDATE" | "UNRESOLVED";
export class CausalSubjectId {
  readonly value: string;
  private constructor(value: string) {
    this.value = value;
    Object.freeze(this);
  }
  static create(value: string) {
    if (!/^[a-z][a-z0-9:_-]{1,127}$/.test(value)) throw new Error("Invalid causal subject id");
    return new CausalSubjectId(value);
  }
}
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
  queueDepth?: number;
  arrivalRate?: number;
  serviceCapacity?: number;
  utilization?: number;
  singlePersonConstraint?: boolean;
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
  readonly queueDepth: number;
  readonly arrivalRate: number;
  readonly serviceCapacity: number;
  readonly utilization: number;
  readonly singlePersonConstraint: boolean;
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
    this.queueDepth = nonNegative(input.queueDepth ?? 0, "queueDepth");
    this.arrivalRate = nonNegative(input.arrivalRate ?? 0, "arrivalRate");
    this.serviceCapacity = nonNegative(input.serviceCapacity ?? 0, "serviceCapacity");
    this.utilization = ratio(
      input.utilization ??
        Math.min(1, this.serviceCapacity ? this.arrivalRate / this.serviceCapacity : 0),
      "utilization",
    );
    this.singlePersonConstraint = input.singlePersonConstraint ?? false;
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
  semanticKey?: string;
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
  semanticKey?: string;
  stepId: string;
  reason: string;
  evidenceIds: readonly string[];
  confidence: number;
  impact: number;
  observed: boolean;
  type?:
    | "CAPACITY"
    | "QUEUE"
    | "APPROVAL"
    | "HANDOFF"
    | "REWORK"
    | "EXCEPTION"
    | "ROLE"
    | "SYSTEM"
    | "CONTROL"
    | "DATA"
    | "UNKNOWN";
  signals?: readonly BottleneckSignal[];
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  materiality?: number;
  warnings?: readonly string[];
}
export type BottleneckSignalFamily =
  | "WAITING_TIME"
  | "QUEUE_ACCUMULATION"
  | "CAPACITY_MISMATCH"
  | "HIGH_UTILIZATION"
  | "APPROVAL_LATENCY"
  | "REWORK_AMPLIFICATION"
  | "EXCEPTION_OVERLOAD"
  | "HANDOFF_DELAY"
  | "SINGLE_PERSON_CONSTRAINT"
  | "DOWNSTREAM_STARVATION"
  | "UPSTREAM_CONGESTION"
  | "THROUGHPUT_LIMIT"
  | "CONTROL_CONSTRAINT";
export interface BottleneckSignal {
  family: BottleneckSignalFamily;
  source: string;
  metric: string;
  strength: number;
  confidence: number;
  supportingEvidence: readonly string[];
  affectedStep: string;
}
export class BottleneckSignalModel {
  signals(step: ProcessStep): readonly BottleneckSignal[] {
    const signals: BottleneckSignal[] = [];
    const add = (family: BottleneckSignalFamily, metric: string, strength: number) => {
      if (strength > 0)
        signals.push({
          family,
          source: `process-step:${step.stepId}`,
          metric,
          strength: Math.min(1, strength),
          confidence: 0.8,
          supportingEvidence: [],
          affectedStep: step.stepId,
        });
    };
    add(
      "WAITING_TIME",
      "waiting/process ratio",
      step.processingMinutes
        ? Math.max(0, (step.waitingMinutes / step.processingMinutes - 2) / 2)
        : 0,
    );
    add("QUEUE_ACCUMULATION", "queue depth", Math.min(1, step.queueDepth / 10));
    add(
      "CAPACITY_MISMATCH",
      "arrival vs service capacity",
      step.serviceCapacity && step.arrivalRate > step.serviceCapacity
        ? (step.arrivalRate - step.serviceCapacity) / step.serviceCapacity
        : 0,
    );
    add("HIGH_UTILIZATION", "utilization", Math.max(0, step.utilization - 0.8) / 0.2);
    add("REWORK_AMPLIFICATION", "rework rate", step.reworkRate);
    add("EXCEPTION_OVERLOAD", "exception frequency", step.exceptionFrequency);
    if (step.singlePersonConstraint) add("SINGLE_PERSON_CONSTRAINT", "single-person constraint", 1);
    return Object.freeze(signals.map((signal) => Object.freeze(signal)));
  }
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
    const hasCrossSystemHandoff = model.handoffs.some(
      (h) => h.fromSystem && h.toSystem && h.fromSystem !== h.toSystem,
    );
    const weakData = model.process.steps.some((s) => s.errorRate >= 0.1);
    if (hasCrossSystemHandoff || weakData) {
      const semanticKey = weakData ? "cause:poor-master-data" : "cause:system-fragmentation";
      const supportingEvidenceIds = evidence.map((e) => e.evidenceId);
      results.push({
        causeId: semanticKey,
        semanticKey,
        kind: "CANDIDATE",
        statement: weakData
          ? "Poor master data may explain downstream errors"
          : "System fragmentation may explain manual handoff delays",
        affectedStepIds: model.process.steps.map((s) => s.stepId),
        supportingClaimIds: claims.map((c) => c.claimId),
        supportingEvidenceIds,
        confidence: supportingEvidenceIds.length ? 0.8 : 0,
        relationship: "DIRECT",
        competingCauseIds: [],
        unresolvedUnknownIds: [],
        trace: ReasoningTrace.create({ [semanticKey]: "Canonical causal candidate" }, []),
      });
    }
    return Object.freeze(results);
  }
}

export interface RootCauseSelection {
  selectedRootCauses: readonly CauseCandidate[];
  contributingCauses: readonly CauseCandidate[];
  symptomCandidates: readonly CauseCandidate[];
  unresolvedCandidates: readonly CauseCandidate[];
  scoreBreakdown: Readonly<Record<string, number>>;
}
export class RootCauseSelector {
  select(
    candidates: readonly CauseCandidate[],
    contradictions = 0,
    unknowns = 0,
  ): RootCauseSelection {
    const ranked = [...candidates].sort(
      (a, b) => b.confidence - a.confidence || a.causeId.localeCompare(b.causeId),
    );
    const selected =
      contradictions > 0 || unknowns > 0
        ? []
        : ranked
            .filter((c) => c.semanticKey?.startsWith("cause:") && c.confidence >= 0.6)
            .slice(0, 1);
    const selectedIds = new Set(selected.map((c) => c.causeId));
    return Object.freeze({
      selectedRootCauses: Object.freeze(selected.map((c) => ({ ...c, kind: "ROOT" as const }))),
      contributingCauses: Object.freeze(
        ranked
          .filter((c) => !selectedIds.has(c.causeId))
          .slice(0, 3)
          .map((c) => ({ ...c, kind: "CONTRIBUTING" as const })),
      ),
      symptomCandidates: Object.freeze([]),
      unresolvedCandidates: Object.freeze(contradictions || unknowns ? ranked : []),
      scoreBreakdown: Object.freeze(
        Object.fromEntries(ranked.map((c) => [c.causeId, c.confidence])),
      ),
    });
  }
}
export class BottleneckDetector {
  detect(model: ProcessModel): readonly Bottleneck[] {
    return Object.freeze(
      model.process.steps
        .map((s): Bottleneck | null => {
          const signals = new BottleneckSignalModel().signals(s);
          const strong = signals.filter((signal) => signal.strength >= 0.3);
          if (!strong.length && s.volume < 100) return null;
          const primary = strong.sort(
            (a, b) => b.strength - a.strength || a.family.localeCompare(b.family),
          )[0];
          const materiality = Math.min(1, (s.volume / 100) * 0.3 + (primary?.strength ?? 0) * 0.7);
          const type =
            primary?.family === "APPROVAL_LATENCY" || s.decisionPoint
              ? "APPROVAL"
              : primary?.family === "QUEUE_ACCUMULATION"
                ? "QUEUE"
                : primary?.family === "REWORK_AMPLIFICATION"
                  ? "REWORK"
                  : primary?.family === "EXCEPTION_OVERLOAD"
                    ? "EXCEPTION"
                    : primary?.family === "SINGLE_PERSON_CONSTRAINT"
                      ? "ROLE"
                      : "CAPACITY";
          return {
            bottleneckId: `bottleneck:${s.stepId}`,
            semanticKey: `bottleneck:${s.stepId}`,
            stepId: s.stepId,
            reason: primary?.metric ?? "Capacity pressure",
            evidenceIds: [],
            confidence: 0.7,
            impact: materiality,
            observed: true,
            type,
            signals: Object.freeze(strong),
            severity: materiality >= 0.8 ? "HIGH" : materiality >= 0.5 ? "MEDIUM" : "LOW",
            materiality,
            warnings: Object.freeze([]),
          };
        })
        .filter((b): b is Bottleneck => b !== null),
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
