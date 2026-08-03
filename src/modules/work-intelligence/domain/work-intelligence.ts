export type WorkEvidenceKind = "DECLARED" | "OBSERVED";
export type WorkActivitySource = "MANUAL" | "AUDIT" | "IMPORT" | "CONNECTOR" | "INFERRED";
export type HumanConfirmationState = "PENDING" | "CONFIRMED" | "CORRECTED" | "REJECTED";
export type PatternConfidence = "LOW" | "MEDIUM" | "HIGH";
export type ProposedAutomationGovernance =
  | "HUMAN_ONLY"
  | "AI_ASSISTED"
  | "AUTOMATION_WITH_APPROVAL"
  | "AUTOMATION_WITH_EXCEPTION_HANDLING"
  | "AUTONOMOUS";

export interface WorkActivityInput {
  activityId: string;
  lineageId?: string;
  version?: number;
  tenantId: string;
  companyId: string;
  actorRole: string;
  departmentId?: string | null;
  evidenceKind: WorkEvidenceKind;
  activityType: string;
  originalDescription: string;
  normalizedActivity: string;
  category: string;
  tools?: readonly string[];
  startedAt: Date;
  endedAt?: Date | null;
  durationMinutes?: number | null;
  source: WorkActivitySource;
  confidence: number;
  confirmationState?: HumanConfirmationState;
  recurrenceHints?: readonly string[];
  humanJudgment: number;
  operationalRisk: number;
  metadata?: Readonly<Record<string, unknown>>;
  provenance: readonly string[];
  supersedesActivityId?: string | null;
}

export class WorkActivity {
  readonly activityId: string;
  readonly lineageId: string;
  readonly version: number;
  readonly tenantId: string;
  readonly companyId: string;
  readonly actorRole: string;
  readonly departmentId: string | null;
  readonly evidenceKind: WorkEvidenceKind;
  readonly activityType: string;
  readonly originalDescription: string;
  readonly normalizedActivity: string;
  readonly category: string;
  readonly tools: readonly string[];
  readonly startedAt: Date;
  readonly endedAt: Date;
  readonly durationMinutes: number;
  readonly source: WorkActivitySource;
  readonly confidence: number;
  readonly confirmationState: HumanConfirmationState;
  readonly recurrenceHints: readonly string[];
  readonly humanJudgment: number;
  readonly operationalRisk: number;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly provenance: readonly string[];
  readonly supersedesActivityId: string | null;

  private constructor(input: WorkActivityInput) {
    this.activityId = required(input.activityId, "Activity id");
    this.lineageId = required(input.lineageId ?? input.activityId, "Activity lineage id");
    this.version = positiveInteger(input.version ?? 1, "Activity version");
    this.tenantId = required(input.tenantId, "Tenant id");
    this.companyId = required(input.companyId, "Company id");
    this.actorRole = required(input.actorRole, "Actor role");
    this.departmentId = optional(input.departmentId);
    this.evidenceKind = oneOf(input.evidenceKind, ["DECLARED", "OBSERVED"], "Evidence kind");
    this.activityType = required(input.activityType, "Activity type");
    this.originalDescription = required(input.originalDescription, "Original description");
    this.normalizedActivity = required(input.normalizedActivity, "Normalized activity");
    this.category = required(input.category, "Activity category");
    this.tools = strings(input.tools ?? []);
    this.startedAt = validDate(input.startedAt, "Activity start");
    const duration = input.durationMinutes ?? durationBetween(input.startedAt, input.endedAt);
    this.durationMinutes = positiveNumber(duration, "Activity duration");
    this.endedAt = validDate(
      input.endedAt ?? new Date(this.startedAt.getTime() + this.durationMinutes * 60_000),
      "Activity end",
    );
    if (this.endedAt <= this.startedAt)
      throw new WorkIntelligenceError("Activity end must follow start");
    this.source = oneOf(
      input.source,
      ["MANUAL", "AUDIT", "IMPORT", "CONNECTOR", "INFERRED"],
      "Activity source",
    );
    this.confidence = score(input.confidence, "Activity confidence");
    this.confirmationState = oneOf(
      input.confirmationState ?? "PENDING",
      ["PENDING", "CONFIRMED", "CORRECTED", "REJECTED"],
      "Confirmation state",
    );
    this.recurrenceHints = strings(input.recurrenceHints ?? []);
    this.humanJudgment = score(input.humanJudgment, "Human judgment");
    this.operationalRisk = score(input.operationalRisk, "Operational risk");
    this.metadata = immutableRecord(input.metadata ?? {});
    this.provenance = strings(input.provenance);
    if (this.provenance.length === 0)
      throw new WorkIntelligenceError("Activity provenance is required");
    this.supersedesActivityId = optional(input.supersedesActivityId);
    Object.freeze(this);
  }

  static create(input: WorkActivityInput): WorkActivity {
    return new WorkActivity(input);
  }

  confirm(activityId: string): WorkActivity {
    if (this.confirmationState === "REJECTED")
      throw new WorkIntelligenceError("Rejected activity cannot be confirmed");
    return WorkActivity.create({
      ...this.snapshot(activityId),
      confirmationState: "CONFIRMED",
      confidence: 100,
      source: "MANUAL",
    });
  }

  correct(activityId: string, correction: WorkActivityCorrection): WorkActivity {
    return WorkActivity.create({
      ...this.snapshot(activityId),
      ...correction,
      confirmationState: "CORRECTED",
      confidence: 100,
      source: "MANUAL",
      provenance: [...this.provenance, `human-correction:${activityId}`],
      supersedesActivityId: this.activityId,
    });
  }

  private snapshot(activityId: string): WorkActivityInput {
    return {
      activityId,
      lineageId: this.lineageId,
      version: this.version + 1,
      tenantId: this.tenantId,
      companyId: this.companyId,
      actorRole: this.actorRole,
      departmentId: this.departmentId,
      evidenceKind: this.evidenceKind,
      activityType: this.activityType,
      originalDescription: this.originalDescription,
      normalizedActivity: this.normalizedActivity,
      category: this.category,
      tools: this.tools,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      durationMinutes: this.durationMinutes,
      source: this.source,
      confidence: this.confidence,
      confirmationState: this.confirmationState,
      recurrenceHints: this.recurrenceHints,
      humanJudgment: this.humanJudgment,
      operationalRisk: this.operationalRisk,
      metadata: this.metadata,
      provenance: this.provenance,
      supersedesActivityId: this.supersedesActivityId,
    };
  }
}

export type WorkActivityCorrection = Partial<
  Pick<
    WorkActivityInput,
    | "actorRole"
    | "departmentId"
    | "activityType"
    | "originalDescription"
    | "normalizedActivity"
    | "category"
    | "tools"
    | "startedAt"
    | "endedAt"
    | "durationMinutes"
    | "recurrenceHints"
    | "humanJudgment"
    | "operationalRisk"
    | "metadata"
  >
>;

export interface ActivityNormalization {
  normalizedActivity: string;
  category: string;
  confidence: number;
  ruleVersion: string;
  matchedTerms: readonly string[];
}

export interface ActivityNormalizer {
  normalize(originalDescription: string): ActivityNormalization;
}

export interface ActivityNormalizationRule {
  readonly code: string;
  readonly category: string;
  readonly terms: readonly string[];
}

export class DeterministicActivityNormalizer implements ActivityNormalizer {
  readonly version: string;
  private readonly rules: readonly ActivityNormalizationRule[];

  constructor(rules: readonly ActivityNormalizationRule[] = [], version = "work-normalization-v1") {
    this.version = required(version, "Normalization rule version");
    const codes = new Set<string>();
    this.rules = Object.freeze(
      rules.map((rule) => {
        const code = required(rule.code, "Normalization rule code");
        if (codes.has(code))
          throw new WorkIntelligenceError(`Duplicate normalization rule: ${code}`);
        codes.add(code);
        const terms = strings(rule.terms);
        if (terms.length === 0)
          throw new WorkIntelligenceError(`Normalization rule ${code} requires at least one term`);
        return Object.freeze({
          code,
          category: required(rule.category, "Activity category"),
          terms,
        });
      }),
    );
  }

  normalize(originalDescription: string): ActivityNormalization {
    const normalized = normalizeText(originalDescription);
    const rule = this.rules.find((candidate) =>
      candidate.terms.some((term) => normalized.includes(normalizeText(term))),
    );
    const matchedTerms =
      rule?.terms.filter((term) => normalized.includes(normalizeText(term))) ?? [];
    return Object.freeze({
      normalizedActivity: rule?.code ?? `OTHER_${slug(normalized).toUpperCase()}`,
      category: rule?.category ?? "Other",
      confidence: rule ? Math.min(95, 70 + matchedTerms.length * 10) : 40,
      ruleVersion: this.version,
      matchedTerms: Object.freeze(matchedTerms),
    });
  }
}

export interface WorkPattern {
  patternId: string;
  tenantId: string;
  companyId: string;
  normalizedActivity: string;
  category: string;
  frequencyDaysPerWeek: number;
  averageDurationMinutes: number;
  tools: readonly string[];
  recurrence: string;
  confidence: PatternConfidence;
  confidenceScore: number;
  sampleCount: number;
  observationWindow: { from: Date; to: Date; days: number };
  averageHumanJudgment: number;
  averageOperationalRisk: number;
  provenance: readonly string[];
}

export interface WorkPatternAnalysis {
  patterns: readonly Readonly<WorkPattern>[];
  insufficientGroups: readonly { normalizedActivity: string; sampleCount: number }[];
  ruleVersion: string;
}

export class WorkPatternEngine {
  static readonly minimumSamples = 3;
  readonly version = "work-pattern-v1";

  analyze(activities: readonly WorkActivity[]): WorkPatternAnalysis {
    const eligible = latestActivities(activities).filter(
      (activity) =>
        activity.evidenceKind === "OBSERVED" &&
        ["CONFIRMED", "CORRECTED"].includes(activity.confirmationState),
    );
    const groups = groupBy(
      eligible,
      (activity) => `${activity.tenantId}:${activity.companyId}:${activity.normalizedActivity}`,
    );
    const patterns: WorkPattern[] = [];
    const insufficientGroups: { normalizedActivity: string; sampleCount: number }[] = [];
    for (const [, samples] of [...groups.entries()].sort()) {
      const normalizedActivity = samples[0]?.normalizedActivity;
      if (!normalizedActivity) continue;
      if (samples.length < WorkPatternEngine.minimumSamples) {
        insufficientGroups.push({ normalizedActivity, sampleCount: samples.length });
        continue;
      }
      const starts = samples.map((sample) => sample.startedAt.getTime());
      const from = new Date(Math.min(...starts));
      const to = new Date(Math.max(...starts));
      const windowDays = Math.max(1, Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1);
      const observedDays = new Set(
        samples.map((sample) => sample.startedAt.toISOString().slice(0, 10)),
      ).size;
      const confidenceScore = round(
        average(samples.map((sample) => sample.confidence)) * Math.min(1, samples.length / 6),
      );
      patterns.push(
        Object.freeze({
          patternId: `${samples[0]!.companyId}:${normalizedActivity}:${this.version}`,
          tenantId: samples[0]!.tenantId,
          companyId: samples[0]!.companyId,
          normalizedActivity,
          category: samples[0]!.category,
          frequencyDaysPerWeek: round((observedDays / windowDays) * 7, 2),
          averageDurationMinutes: round(
            average(samples.map((sample) => sample.durationMinutes)),
            2,
          ),
          tools: strings(samples.flatMap((sample) => sample.tools)),
          recurrence: recurrence(observedDays, windowDays),
          confidence: confidenceLabel(confidenceScore),
          confidenceScore,
          sampleCount: samples.length,
          observationWindow: Object.freeze({ from, to, days: windowDays }),
          averageHumanJudgment: round(average(samples.map((sample) => sample.humanJudgment)), 2),
          averageOperationalRisk: round(
            average(samples.map((sample) => sample.operationalRisk)),
            2,
          ),
          provenance: strings(samples.map((sample) => sample.activityId)),
        }),
      );
    }
    return Object.freeze({
      patterns: Object.freeze(patterns),
      insufficientGroups: Object.freeze(insufficientGroups),
      ruleVersion: this.version,
    });
  }
}

export interface AuditWorkContext {
  knownToolIds: readonly string[];
  declaredActivityCodes: readonly string[];
  evidenceReferences: readonly string[];
}

export interface AutomationOpportunityDimensions {
  repetition: number;
  frequency: number;
  predictability: number;
  toolReadiness: number;
  estimatedTimeCost: number;
  humanJudgment: number;
  operationalRisk: number;
  dataQuality: number;
}

export interface WorkAutomationHypothesis {
  hypothesisId: string;
  patternId: string;
  tenantId: string;
  companyId: string;
  score: number;
  dimensions: Readonly<AutomationOpportunityDimensions>;
  contributions: Readonly<Record<string, number>>;
  confidence: number;
  proposedGovernance: ProposedAutomationGovernance;
  explanation: string;
  tools: readonly string[];
  provenance: readonly string[];
  ruleVersion: string;
}

const OPPORTUNITY_WEIGHTS = Object.freeze({
  repetition: 0.2,
  frequency: 0.15,
  predictability: 0.15,
  toolReadiness: 0.15,
  estimatedTimeCost: 0.15,
  humanSuitability: 0.1,
  riskSuitability: 0.1,
});

export class WorkAutomationHypothesisEngine {
  readonly version = "work-automation-hypothesis-v1";

  evaluate(pattern: WorkPattern, audit: AuditWorkContext): WorkAutomationHypothesis {
    assertTenant(pattern.tenantId, pattern.companyId);
    const knownTools = new Set(audit.knownToolIds);
    const knownToolCount = pattern.tools.filter((tool) => knownTools.has(tool)).length;
    const dimensions: AutomationOpportunityDimensions = Object.freeze({
      repetition: clamp(pattern.sampleCount * 15),
      frequency: clamp(pattern.frequencyDaysPerWeek * 20),
      predictability: pattern.confidenceScore,
      toolReadiness: pattern.tools.length
        ? clamp(60 + (knownToolCount / pattern.tools.length) * 40)
        : 20,
      estimatedTimeCost: clamp((pattern.frequencyDaysPerWeek * pattern.averageDurationMinutes) / 3),
      humanJudgment: pattern.averageHumanJudgment,
      operationalRisk: pattern.averageOperationalRisk,
      dataQuality: pattern.confidenceScore,
    });
    const contributions = Object.freeze({
      repetition: round(dimensions.repetition * OPPORTUNITY_WEIGHTS.repetition),
      frequency: round(dimensions.frequency * OPPORTUNITY_WEIGHTS.frequency),
      predictability: round(dimensions.predictability * OPPORTUNITY_WEIGHTS.predictability),
      toolReadiness: round(dimensions.toolReadiness * OPPORTUNITY_WEIGHTS.toolReadiness),
      estimatedTimeCost: round(
        dimensions.estimatedTimeCost * OPPORTUNITY_WEIGHTS.estimatedTimeCost,
      ),
      humanSuitability: round(
        (100 - dimensions.humanJudgment) * OPPORTUNITY_WEIGHTS.humanSuitability,
      ),
      riskSuitability: round(
        (100 - dimensions.operationalRisk) * OPPORTUNITY_WEIGHTS.riskSuitability,
      ),
    });
    const total = round(Object.values(contributions).reduce((sum, value) => sum + value, 0));
    const proposedGovernance = proposeAutomationGovernance(dimensions, pattern.confidenceScore);
    return Object.freeze({
      hypothesisId: `${pattern.patternId}:${this.version}`,
      patternId: pattern.patternId,
      tenantId: pattern.tenantId,
      companyId: pattern.companyId,
      score: total,
      dimensions,
      contributions,
      confidence: pattern.confidenceScore,
      proposedGovernance,
      explanation: explanation(pattern, dimensions, proposedGovernance),
      tools: pattern.tools,
      provenance: strings([...pattern.provenance, ...audit.evidenceReferences]),
      ruleVersion: this.version,
    });
  }
}

export interface TimeSavingsEstimate {
  observedTimePerWeekMinutes: number;
  frequencyDaysPerWeek: number;
  estimatedAutomatableTimeMinutes: number;
  estimatedHumanTimeRemainingMinutes: number;
  confidence: number;
  assumptions: readonly string[];
  provenance: readonly string[];
}

export function estimateTimeSavings(
  pattern: WorkPattern,
  governance: ProposedAutomationGovernance,
): Readonly<TimeSavingsEstimate> {
  const current = round(pattern.frequencyDaysPerWeek * pattern.averageDurationMinutes, 2);
  const ratio: Record<ProposedAutomationGovernance, number> = {
    HUMAN_ONLY: 0,
    AI_ASSISTED: 0.25,
    AUTOMATION_WITH_APPROVAL: 0.6,
    AUTOMATION_WITH_EXCEPTION_HANDLING: 0.8,
    AUTONOMOUS: 0.9,
  };
  const automatable = round(current * ratio[governance], 2);
  return Object.freeze({
    observedTimePerWeekMinutes: current,
    frequencyDaysPerWeek: pattern.frequencyDaysPerWeek,
    estimatedAutomatableTimeMinutes: automatable,
    estimatedHumanTimeRemainingMinutes: round(current - automatable, 2),
    confidence: pattern.confidenceScore,
    assumptions: Object.freeze([
      `Observed average duration: ${pattern.averageDurationMinutes} minutes`,
      `Proposed governance time ratio: ${ratio[governance]}`,
    ]),
    provenance: pattern.provenance,
  });
}

export interface AutomationCandidate {
  candidateId: string;
  tenantId: string;
  companyId: string;
  sourceHypothesisId: string;
  sourcePatternIds: readonly string[];
  supportingObservationIds: readonly string[];
  score: number;
  confidence: number;
  proposedGovernance: ProposedAutomationGovernance;
  tools: readonly string[];
  requiresHumanApproval: boolean;
  timeSavingsEstimate: Readonly<TimeSavingsEstimate>;
  riskClassification: "LOW" | "MEDIUM" | "HIGH";
  explanation: string;
  provenance: readonly string[];
}

export function qualifyAutomationCandidate(
  opportunity: WorkAutomationHypothesis,
  pattern: WorkPattern,
): Readonly<AutomationCandidate> | null {
  if (
    opportunity.score < 65 ||
    opportunity.confidence < 50 ||
    opportunity.proposedGovernance === "HUMAN_ONLY" ||
    pattern.sampleCount < WorkPatternEngine.minimumSamples
  )
    return null;
  return Object.freeze({
    candidateId: `${opportunity.hypothesisId}:candidate-v1`,
    tenantId: opportunity.tenantId,
    companyId: opportunity.companyId,
    sourceHypothesisId: opportunity.hypothesisId,
    sourcePatternIds: Object.freeze([pattern.patternId]),
    supportingObservationIds: pattern.provenance,
    score: opportunity.score,
    confidence: opportunity.confidence,
    proposedGovernance: opportunity.proposedGovernance,
    tools: opportunity.tools,
    requiresHumanApproval: opportunity.proposedGovernance !== "AUTONOMOUS",
    timeSavingsEstimate: estimateTimeSavings(pattern, opportunity.proposedGovernance),
    riskClassification:
      opportunity.dimensions.operationalRisk >= 70
        ? "HIGH"
        : opportunity.dimensions.operationalRisk >= 40
          ? "MEDIUM"
          : "LOW",
    explanation: opportunity.explanation,
    provenance: strings([...opportunity.provenance, opportunity.hypothesisId]),
  });
}

export class WorkIntelligenceError extends Error {}

function proposeAutomationGovernance(
  dimensions: AutomationOpportunityDimensions,
  confidence: number,
): ProposedAutomationGovernance {
  if (dimensions.operationalRisk >= 80 || dimensions.humanJudgment >= 85) return "HUMAN_ONLY";
  if (confidence < 50) return "AI_ASSISTED";
  if (dimensions.operationalRisk >= 50 || dimensions.humanJudgment >= 50)
    return "AUTOMATION_WITH_APPROVAL";
  if (dimensions.predictability >= 80 && confidence >= 80 && dimensions.operationalRisk < 25)
    return "AUTONOMOUS";
  return "AUTOMATION_WITH_EXCEPTION_HANDLING";
}

function explanation(
  pattern: WorkPattern,
  dimensions: AutomationOpportunityDimensions,
  governance: ProposedAutomationGovernance,
): string {
  return `${pattern.normalizedActivity}: observed ${pattern.sampleCount} times over ${pattern.observationWindow.days} days; repetition ${dimensions.repetition}/100, predictability ${dimensions.predictability}/100, human judgment ${dimensions.humanJudgment}/100, risk ${dimensions.operationalRisk}/100; proposed governance ${governance}.`;
}

function latestActivities(activities: readonly WorkActivity[]): WorkActivity[] {
  const latest = new Map<string, WorkActivity>();
  for (const activity of activities) {
    const existing = latest.get(activity.lineageId);
    if (!existing || activity.version > existing.version) latest.set(activity.lineageId, activity);
  }
  return [...latest.values()];
}

function groupBy<T>(values: readonly T[], key: (value: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const value of values) result.set(key(value), [...(result.get(key(value)) ?? []), value]);
  return result;
}

function recurrence(days: number, window: number): string {
  const weekly = (days / window) * 7;
  return weekly >= 5 ? "DAILY" : weekly >= 1 ? "WEEKLY" : "OCCASIONAL";
}

function confidenceLabel(value: number): PatternConfidence {
  return value >= 80 ? "HIGH" : value >= 50 ? "MEDIUM" : "LOW";
}

function durationBetween(startedAt: Date, endedAt: Date | null | undefined): number {
  if (!endedAt) throw new WorkIntelligenceError("Activity duration or end is required");
  return (endedAt.getTime() - startedAt.getTime()) / 60_000;
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 512)
    throw new WorkIntelligenceError(`${label} is invalid`);
  return normalized;
}

function optional(value: string | null | undefined): string | null {
  return value === null || value === undefined ? null : required(value, "Optional identifier");
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new WorkIntelligenceError(`${label} is invalid`);
  return value;
}

function positiveNumber(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new WorkIntelligenceError(`${label} is invalid`);
  return value;
}

function score(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 100)
    throw new WorkIntelligenceError(`${label} must be between 0 and 100`);
  return value;
}

function validDate(value: Date, label: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime()))
    throw new WorkIntelligenceError(`${label} is invalid`);
  return new Date(value.getTime());
}

function strings(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.map((value) => required(value, "Value")))].sort());
}

function oneOf<T extends string>(value: string, values: readonly T[], label: string): T {
  if (!values.includes(value as T)) throw new WorkIntelligenceError(`${label} is invalid`);
  return value as T;
}

function immutableRecord(
  value: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new WorkIntelligenceError("Metadata must be JSON-compatible");
  const parsed = JSON.parse(serialized) as Record<string, unknown>;
  rejectSensitiveMetadata(parsed);
  return Object.freeze(parsed);
}

function rejectSensitiveMetadata(value: unknown): void {
  if (Array.isArray(value)) return value.forEach(rejectSensitiveMetadata);
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (/(password|secret|token|authorization|cookie|api[-_]?key)/i.test(key))
      throw new WorkIntelligenceError(`Sensitive metadata field ${key} is forbidden`);
    rejectSensitiveMetadata(nested);
  }
}

function normalizeText(value: string): string {
  return required(value, "Description")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function slug(value: string): string {
  return (
    value
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 80) || "ACTIVITY"
  );
}

function average(values: readonly number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp(value: number): number {
  return round(Math.max(0, Math.min(100, value)));
}

function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function assertTenant(tenantId: string, companyId: string): void {
  required(tenantId, "Tenant id");
  required(companyId, "Company id");
}
