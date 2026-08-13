import type { Claim, Evidence } from "./brain-contracts";

export type KnowledgeType =
  | "PROCESS_PATTERN"
  | "PROBLEM_PATTERN"
  | "ROOT_CAUSE_PATTERN"
  | "AUTOMATION_PATTERN"
  | "SOLUTION_PATTERN"
  | "INTEGRATION_PATTERN"
  | "CONTROL_PATTERN"
  | "RISK_PATTERN"
  | "FAILURE_PATTERN"
  | "BENCHMARK"
  | "RULE"
  | "CAPABILITY_REFERENCE"
  | "SECTOR_KNOWLEDGE";
export type KnowledgeScopeDimension =
  | "GLOBAL"
  | "SECTOR"
  | "PROCESS_TYPE"
  | "FUNCTION"
  | "TECHNOLOGY"
  | "REGION"
  | "REGULATION"
  | "COMPANY_SIZE";
export type ProvenanceCategory =
  | "AUTHORITATIVE_SOURCE"
  | "VENDOR_DOCUMENTATION"
  | "INDUSTRY_REFERENCE"
  | "INTERNAL_CURATED"
  | "OBSERVED_OUTCOME"
  | "EXPERT_CURATED"
  | "SYNTHETIC_TEST";
export type KnowledgeLifecycle = "ACTIVE" | "DEPRECATED" | "SUPERSEDED";
export type PatternMatchStatus = "MATCH" | "PARTIAL_MATCH" | "INSUFFICIENT_EVIDENCE" | "REJECTED";
export type BrainCandidateKind =
  | "HYPOTHESIS"
  | "CAUSE_CANDIDATE"
  | "SOLUTION_CANDIDATE"
  | "BENCHMARK_COMPARISON"
  | "CLARIFICATION_SUGGESTION";

const req = (value: string, label: string) => {
  if (!value.trim()) throw new Error(`${label} is required`);
  return value.trim();
};
const list = (values: readonly string[] = []) =>
  Object.freeze([...new Set(values.map((v) => req(v, "value")))]);
const immutable = <T extends object>(value: T) => Object.freeze(value);
const range = (value: number, label: string) => {
  if (!Number.isFinite(value) || value < 0 || value > 1)
    throw new Error(`${label} must be between 0 and 1`);
  return value;
};
const date = (value: Date, label: string) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime()))
    throw new Error(`${label} is invalid`);
  return new Date(value.getTime());
};

export class KnowledgeId {
  readonly value: string;
  private constructor(value: string) {
    this.value = req(value, "Knowledge id");
    immutable(this);
  }
  static create(value: string) {
    return new KnowledgeId(value);
  }
}
export class KnowledgeVersion {
  readonly value: number;
  private constructor(value: number) {
    if (!Number.isInteger(value) || value < 1)
      throw new Error("Knowledge version must be positive");
    this.value = value;
    immutable(this);
  }
  static create(value: number) {
    return new KnowledgeVersion(value);
  }
}
export class KnowledgeReliability {
  readonly value: number;
  private constructor(value: number) {
    this.value = range(value, "Knowledge reliability");
    immutable(this);
  }
  static create(value: number) {
    return new KnowledgeReliability(value);
  }
}
export interface KnowledgeScopeInput {
  dimension: KnowledgeScopeDimension;
  value?: string;
}
export class KnowledgeScope {
  readonly dimension: KnowledgeScopeDimension;
  readonly value: string | null;
  private constructor(i: KnowledgeScopeInput) {
    this.dimension = i.dimension;
    this.value = i.value?.trim() || null;
    if (i.dimension !== "GLOBAL" && !this.value)
      throw new Error("Scoped knowledge requires a value");
    immutable(this);
  }
  static create(i: KnowledgeScopeInput) {
    return new KnowledgeScope(i);
  }
}
export interface KnowledgeProvenanceInput {
  category: ProvenanceCategory;
  sourceId: string;
  sourceLabel: string;
  capturedAt: Date;
  synthetic?: boolean;
  details?: Readonly<Record<string, string>>;
}
export class KnowledgeProvenance {
  readonly category: ProvenanceCategory;
  readonly sourceId: string;
  readonly sourceLabel: string;
  readonly capturedAt: Date;
  readonly synthetic: boolean;
  readonly details: Readonly<Record<string, string>>;
  private constructor(i: KnowledgeProvenanceInput) {
    this.category = i.category;
    this.sourceId = req(i.sourceId, "sourceId");
    this.sourceLabel = req(i.sourceLabel, "sourceLabel");
    this.capturedAt = date(i.capturedAt, "capturedAt");
    this.synthetic = i.synthetic ?? i.category === "SYNTHETIC_TEST";
    if (i.category === "SYNTHETIC_TEST" && !this.synthetic)
      throw new Error("Synthetic provenance must be labelled synthetic");
    this.details = immutable({ ...i.details });
    immutable(this);
  }
  static create(i: KnowledgeProvenanceInput) {
    return new KnowledgeProvenance(i);
  }
}

export interface KnowledgeItemInput {
  id: string;
  type: KnowledgeType;
  title: string;
  description: string;
  domain: string;
  tags?: readonly string[];
  scope: KnowledgeScope;
  provenance: KnowledgeProvenance;
  reliability: KnowledgeReliability;
  version: KnowledgeVersion;
  validFrom: Date;
  validUntil?: Date;
  limitations?: readonly string[];
  applicabilityConditions?: readonly string[];
  lifecycle?: KnowledgeLifecycle;
  supersedesId?: string;
  createdAt: Date;
  updatedAt: Date;
}
export class KnowledgeItem {
  readonly id: string;
  readonly type: KnowledgeType;
  readonly title: string;
  readonly description: string;
  readonly domain: string;
  readonly tags: readonly string[];
  readonly scope: KnowledgeScope;
  readonly provenance: KnowledgeProvenance;
  readonly reliability: KnowledgeReliability;
  readonly version: KnowledgeVersion;
  readonly validFrom: Date;
  readonly validUntil: Date | null;
  readonly limitations: readonly string[];
  readonly applicabilityConditions: readonly string[];
  readonly lifecycle: KnowledgeLifecycle;
  readonly supersedesId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  private constructor(i: KnowledgeItemInput) {
    this.id = KnowledgeId.create(i.id).value;
    this.type = i.type;
    this.title = req(i.title, "title");
    this.description = req(i.description, "description");
    this.domain = req(i.domain, "domain");
    this.tags = list(i.tags);
    this.scope = i.scope;
    this.provenance = i.provenance;
    this.reliability = i.reliability;
    this.version = i.version;
    this.validFrom = date(i.validFrom, "validFrom");
    this.validUntil = i.validUntil ? date(i.validUntil, "validUntil") : null;
    if (this.validUntil && this.validUntil < this.validFrom)
      throw new Error("validUntil precedes validFrom");
    this.limitations = list(i.limitations);
    this.applicabilityConditions = list(i.applicabilityConditions);
    this.lifecycle = i.lifecycle ?? "ACTIVE";
    this.supersedesId = i.supersedesId?.trim() || null;
    this.createdAt = date(i.createdAt, "createdAt");
    this.updatedAt = date(i.updatedAt, "updatedAt");
    immutable(this);
  }
  static create(i: KnowledgeItemInput) {
    return new KnowledgeItem(i);
  }
  isApplicable(at = new Date()) {
    return (
      this.lifecycle === "ACTIVE" &&
      at >= this.validFrom &&
      (!this.validUntil || at <= this.validUntil)
    );
  }
}

export interface PatternInput extends KnowledgeItemInput {
  signals: readonly string[];
  counterSignals?: readonly string[];
  preconditions?: readonly string[];
  requiredEvidence?: readonly string[];
  optionalEvidence?: readonly string[];
  likelyCauses?: readonly string[];
  possibleImpacts?: readonly string[];
  applicableSolutions?: readonly string[];
  risks?: readonly string[];
  controls?: readonly string[];
  rejectionConditions?: readonly string[];
}
export class Pattern {
  readonly item: KnowledgeItem;
  readonly signals: readonly string[];
  readonly counterSignals: readonly string[];
  readonly preconditions: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly optionalEvidence: readonly string[];
  readonly likelyCauses: readonly string[];
  readonly possibleImpacts: readonly string[];
  readonly applicableSolutions: readonly string[];
  readonly risks: readonly string[];
  readonly controls: readonly string[];
  readonly rejectionConditions: readonly string[];
  private constructor(i: PatternInput) {
    this.item = KnowledgeItem.create(i);
    this.signals = list(i.signals);
    if (!this.signals.length) throw new Error("Pattern requires signals");
    this.counterSignals = list(i.counterSignals);
    this.preconditions = list(i.preconditions);
    this.requiredEvidence = list(i.requiredEvidence);
    this.optionalEvidence = list(i.optionalEvidence);
    this.likelyCauses = list(i.likelyCauses);
    this.possibleImpacts = list(i.possibleImpacts);
    this.applicableSolutions = list(i.applicableSolutions);
    this.risks = list(i.risks);
    this.controls = list(i.controls);
    this.rejectionConditions = list(i.rejectionConditions);
    immutable(this);
  }
  static create(i: PatternInput) {
    return new Pattern(i);
  }
}
export interface PatternFacts {
  readonly facts: readonly string[];
  readonly claims?: readonly Claim[];
  readonly evidence?: readonly Evidence[];
  readonly scope?: KnowledgeScope;
}
export interface PatternMatchResult {
  readonly patternId: string;
  readonly status: PatternMatchStatus;
  readonly matchedSignals: readonly string[];
  readonly missingSignals: readonly string[];
  readonly counterSignals: readonly string[];
  readonly score: number;
  readonly rationale: string;
  readonly candidateKind: BrainCandidateKind;
  readonly provenance: KnowledgeProvenance;
}
export class KnowledgeMatcher {
  match(pattern: Pattern, facts: PatternFacts, now = new Date()): PatternMatchResult {
    if (!pattern.item.isApplicable(now))
      return this.result(
        pattern,
        "REJECTED",
        [],
        pattern.signals,
        [],
        0,
        "Knowledge is not active or valid",
        "HYPOTHESIS",
      );
    if (
      pattern.item.scope.dimension !== "GLOBAL" &&
      (!facts.scope ||
        facts.scope.dimension !== pattern.item.scope.dimension ||
        facts.scope.value !== pattern.item.scope.value)
    )
      return this.result(
        pattern,
        "REJECTED",
        [],
        pattern.signals,
        [],
        0,
        "Knowledge scope does not apply",
        "HYPOTHESIS",
      );
    const normalized = facts.facts.map((f) => f.toLowerCase());
    const matched = pattern.signals.filter((s) =>
      normalized.some((f) => f.includes(s.toLowerCase())),
    );
    const missing = pattern.signals.filter((s) => !matched.includes(s));
    const counters = pattern.counterSignals.filter((s) =>
      normalized.some((f) => f.includes(s.toLowerCase())),
    );
    const score = Math.max(
      0,
      Math.min(1, matched.length / pattern.signals.length - counters.length * 0.25),
    );
    const status = counters.length
      ? "REJECTED"
      : matched.length === pattern.signals.length
        ? "MATCH"
        : matched.length
          ? "PARTIAL_MATCH"
          : "INSUFFICIENT_EVIDENCE";
    return this.result(
      pattern,
      status,
      matched,
      missing,
      counters,
      score,
      status === "MATCH"
        ? "All required signals matched"
        : "Evidence is incomplete or counter-signals are present",
      "HYPOTHESIS",
    );
  }
  private result(
    p: Pattern,
    status: PatternMatchStatus,
    matched: readonly string[],
    missing: readonly string[],
    counter: readonly string[],
    score: number,
    rationale: string,
    candidateKind: BrainCandidateKind,
  ): PatternMatchResult {
    return immutable({
      patternId: p.item.id,
      status,
      matchedSignals: Object.freeze([...matched]),
      missingSignals: Object.freeze([...missing]),
      counterSignals: Object.freeze([...counter]),
      score,
      rationale,
      candidateKind,
      provenance: p.item.provenance,
    });
  }
}

export interface BenchmarkInput extends KnowledgeItemInput {
  metric: string;
  value?: number;
  range?: { min: number; max: number };
  unit: string;
  population: string;
  sector?: string;
  companySize?: string;
  region?: string;
  period: string;
  sampleSize: number;
}
export class Benchmark {
  readonly item: KnowledgeItem;
  readonly metric: string;
  readonly value: number | null;
  readonly range: { readonly min: number; readonly max: number } | null;
  readonly unit: string;
  readonly population: string;
  readonly sector: string | null;
  readonly companySize: string | null;
  readonly region: string | null;
  readonly period: string;
  readonly sampleSize: number;
  private constructor(i: BenchmarkInput) {
    this.item = KnowledgeItem.create(i);
    this.metric = req(i.metric, "metric");
    this.value = i.value ?? null;
    this.range = i.range ? immutable({ min: i.range.min, max: i.range.max }) : null;
    if (this.value === null && !this.range) throw new Error("Benchmark requires value or range");
    this.unit = req(i.unit, "unit");
    this.population = req(i.population, "population");
    this.sector = i.sector?.trim() || null;
    this.companySize = i.companySize?.trim() || null;
    this.region = i.region?.trim() || null;
    this.period = req(i.period, "period");
    if (!Number.isInteger(i.sampleSize) || i.sampleSize < 1)
      throw new Error("Benchmark sampleSize must be positive");
    this.sampleSize = i.sampleSize;
    immutable(this);
  }
  static create(i: BenchmarkInput) {
    return new Benchmark(i);
  }
}
export interface SolutionPatternInput extends KnowledgeItemInput {
  problemTypes: readonly string[];
  requiredCapabilities: readonly string[];
  requiredInputs: readonly string[];
  expectedOutputs: readonly string[];
  integrationRequirements?: readonly string[];
  humanControls?: readonly string[];
  operationalRisks?: readonly string[];
  securityConsiderations?: readonly string[];
  maintenanceCharacteristics?: readonly string[];
  costDrivers?: readonly string[];
  failureModes?: readonly string[];
}
export class SolutionPattern {
  readonly item: KnowledgeItem;
  readonly problemTypes: readonly string[];
  readonly requiredCapabilities: readonly string[];
  readonly requiredInputs: readonly string[];
  readonly expectedOutputs: readonly string[];
  readonly integrationRequirements: readonly string[];
  readonly humanControls: readonly string[];
  readonly operationalRisks: readonly string[];
  readonly securityConsiderations: readonly string[];
  readonly maintenanceCharacteristics: readonly string[];
  readonly costDrivers: readonly string[];
  readonly failureModes: readonly string[];
  private constructor(i: SolutionPatternInput) {
    this.item = KnowledgeItem.create(i);
    this.problemTypes = list(i.problemTypes);
    this.requiredCapabilities = list(i.requiredCapabilities);
    this.requiredInputs = list(i.requiredInputs);
    this.expectedOutputs = list(i.expectedOutputs);
    this.integrationRequirements = list(i.integrationRequirements);
    this.humanControls = list(i.humanControls);
    this.operationalRisks = list(i.operationalRisks);
    this.securityConsiderations = list(i.securityConsiderations);
    this.maintenanceCharacteristics = list(i.maintenanceCharacteristics);
    this.costDrivers = list(i.costDrivers);
    this.failureModes = list(i.failureModes);
    immutable(this);
  }
  static create(i: SolutionPatternInput) {
    return new SolutionPattern(i);
  }
}
export interface AutomationPatternInput extends PatternInput {
  steps: readonly string[];
}
export class AutomationPattern {
  readonly pattern: Pattern;
  readonly steps: readonly string[];
  private constructor(i: AutomationPatternInput) {
    this.pattern = Pattern.create(i);
    this.steps = list(i.steps);
    if (!this.steps.length) throw new Error("Automation pattern requires steps");
    immutable(this);
  }
  static create(i: AutomationPatternInput) {
    return new AutomationPattern(i);
  }
}
export type CapabilityCode =
  | "READ_DATA"
  | "WRITE_DATA"
  | "WEBHOOK"
  | "EVENT_SUBSCRIPTION"
  | "DOCUMENT_EXTRACTION"
  | "EMAIL_SEND"
  | "EMAIL_RECEIVE"
  | "CRM_UPDATE"
  | "DATABASE_QUERY"
  | "FILE_STORAGE"
  | "HUMAN_APPROVAL"
  | "LLM_INTERPRETATION";
export class CapabilityReference {
  readonly code: CapabilityCode;
  readonly description: string;
  readonly provenance: KnowledgeProvenance;
  constructor(code: CapabilityCode, description: string, provenance: KnowledgeProvenance) {
    this.code = code;
    this.description = req(description, "description");
    this.provenance = provenance;
    immutable(this);
  }
}
export interface KnowledgeConflict {
  conflictId: string;
  type: "BENCHMARK" | "VERSION" | "SCOPE";
  subject: string;
  itemIds: readonly string[];
  rationale: string;
}
export interface KnowledgeContext {
  relevantPatterns: readonly Pattern[];
  relevantBenchmarks: readonly Benchmark[];
  relevantRules: readonly KnowledgeItem[];
  relevantSolutions: readonly SolutionPattern[];
  relevantCapabilities: readonly CapabilityReference[];
  conflicts: readonly KnowledgeConflict[];
}
export interface KnowledgeLibrary {
  findById(
    id: string,
  ): KnowledgeItem | Pattern | Benchmark | SolutionPattern | CapabilityReference | undefined;
  findByType(type: KnowledgeType): readonly KnowledgeItem[];
  findByDomain(domain: string): readonly (KnowledgeItem | Pattern | Benchmark | SolutionPattern)[];
  findApplicable(scope: KnowledgeScope, now?: Date): readonly KnowledgeItem[];
  findPatterns(scope?: KnowledgeScope, now?: Date): readonly Pattern[];
  getVersion(id: string, version: number): KnowledgeItem | undefined;
}
export class InMemoryKnowledgeLibrary implements KnowledgeLibrary {
  private readonly items = new Map<string, KnowledgeItem | Pattern | Benchmark | SolutionPattern>();
  private readonly capabilities = new Map<string, CapabilityReference>();
  add(item: KnowledgeItem | Pattern | Benchmark | SolutionPattern | CapabilityReference) {
    if (item instanceof CapabilityReference) {
      if (this.capabilities.has(item.code)) throw new Error("Capability already exists");
      this.capabilities.set(item.code, item);
      return item;
    }
    const base =
      item instanceof Pattern || item instanceof Benchmark || item instanceof SolutionPattern
        ? item.item
        : item;
    const key = `${base.id}:${base.version.value}`;
    if (
      [...this.items.values()].some((x) => {
        const b =
          x instanceof Pattern || x instanceof Benchmark || x instanceof SolutionPattern
            ? x.item
            : x;
        return b.id === base.id && b.version.value === base.version.value;
      })
    )
      throw new Error("Knowledge version already exists");
    this.items.set(key, item);
    return item;
  }
  findById(id: string) {
    return [...this.items.values()].find((x) => {
      const b =
        x instanceof Pattern || x instanceof Benchmark || x instanceof SolutionPattern ? x.item : x;
      return b.id === id;
    });
  }
  findByType(type: KnowledgeType) {
    return [...this.items.values()]
      .filter((x) => {
        const b =
          x instanceof Pattern || x instanceof Benchmark || x instanceof SolutionPattern
            ? x.item
            : x;
        return b.type === type;
      })
      .map((x) =>
        x instanceof Pattern || x instanceof Benchmark || x instanceof SolutionPattern ? x.item : x,
      );
  }
  findByDomain(domain: string) {
    return [...this.items.values()].filter((x) => {
      const b =
        x instanceof Pattern || x instanceof Benchmark || x instanceof SolutionPattern ? x.item : x;
      return b.domain === domain;
    });
  }
  findApplicable(scope: KnowledgeScope, now = new Date()) {
    return [...this.items.values()]
      .filter((x) => {
        const b =
          x instanceof Pattern || x instanceof Benchmark || x instanceof SolutionPattern
            ? x.item
            : x;
        return (
          b.scope.dimension === "GLOBAL" ||
          (b.scope.dimension === scope.dimension && b.scope.value === scope.value)
        );
      })
      .filter((x) => {
        const b =
          x instanceof Pattern || x instanceof Benchmark || x instanceof SolutionPattern
            ? x.item
            : x;
        return (
          b.lifecycle === "ACTIVE" && b.validFrom <= now && (!b.validUntil || b.validUntil >= now)
        );
      })
      .map((x) =>
        x instanceof Pattern || x instanceof Benchmark || x instanceof SolutionPattern ? x.item : x,
      );
  }
  findPatterns(scope?: KnowledgeScope, now = new Date()) {
    return [...this.items.values()]
      .filter((x) => x instanceof Pattern)
      .filter(
        (x) =>
          !scope ||
          x.item.scope.dimension === "GLOBAL" ||
          (x.item.scope.dimension === scope.dimension && x.item.scope.value === scope.value),
      )
      .filter((x) => x.item.isApplicable(now)) as Pattern[];
  }
  getVersion(id: string, version: number) {
    return [...this.items.values()]
      .map((x) =>
        x instanceof Pattern || x instanceof Benchmark || x instanceof SolutionPattern ? x.item : x,
      )
      .find((x) => x.id === id && x.version.value === version);
  }
}
export class KnowledgeContextBuilder {
  build(
    library: KnowledgeLibrary,
    scope: KnowledgeScope,
    limits = { patterns: 20, benchmarks: 20, solutions: 20 },
  ): KnowledgeContext {
    const patterns = library.findPatterns(scope).slice(0, limits.patterns);
    const benchmarks = library
      .findByType("BENCHMARK")
      .filter(
        (x) =>
          x.scope.dimension === "GLOBAL" ||
          (x.scope.dimension === scope.dimension && x.scope.value === scope.value),
      )
      .slice(0, limits.benchmarks)
      .map((x) => library.findById(x.id))
      .filter((x): x is Benchmark => x instanceof Benchmark);
    const solutions = library
      .findByType("SOLUTION_PATTERN")
      .slice(0, limits.solutions)
      .map((x) => library.findById(x.id))
      .filter((x): x is SolutionPattern => x instanceof SolutionPattern);
    return immutable({
      relevantPatterns: Object.freeze(patterns),
      relevantBenchmarks: Object.freeze(benchmarks),
      relevantRules: Object.freeze(library.findByType("RULE").slice(0, limits.patterns)),
      relevantSolutions: Object.freeze(solutions),
      relevantCapabilities: Object.freeze([]),
      conflicts: Object.freeze([]),
    });
  }
}
export function candidateFromKnowledge(match: PatternMatchResult): {
  kind: BrainCandidateKind;
  patternId: string;
  status: "CANDIDATE";
  provenance: KnowledgeProvenance;
  assumptions: readonly string[];
} {
  return immutable({
    kind: match.candidateKind,
    patternId: match.patternId,
    status: "CANDIDATE",
    provenance: match.provenance,
    assumptions: Object.freeze(match.missingSignals),
  });
}
