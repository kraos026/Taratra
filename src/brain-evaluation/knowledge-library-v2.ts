import type { KnowledgeScopeDimension, ProvenanceCategory } from "./knowledge-foundation";

export type KnowledgePackStatus = "DRAFT" | "VALIDATED" | "ACTIVE" | "DEPRECATED";
export type KnowledgeQualityStatus = "DRAFT" | "REVIEWED" | "VALIDATED";
export type KnowledgeRelationType =
  | "CAUSES"
  | "CONTRIBUTES_TO"
  | "INDICATES"
  | "MITIGATES"
  | "REQUIRES"
  | "ENABLES"
  | "CONFLICTS_WITH"
  | "ALTERNATIVE_TO"
  | "PRECEDES"
  | "RELATED_TO";
export type CuratedKnowledgeKind =
  | "PROCESS_PATTERN"
  | "ROOT_CAUSE_PATTERN"
  | "ANTI_PATTERN"
  | "SOLUTION_PATTERN"
  | "AUTOMATION_PATTERN"
  | "CONTROL_PATTERN"
  | "RISK_PATTERN"
  | "FAILURE_PATTERN"
  | "CAPABILITY"
  | "BENCHMARK_TEMPLATE";

const freeze = <T>(v: T): T => Object.freeze(v);
const strings = (values: readonly string[] = []) =>
  freeze([...new Set(values.map((v) => v.trim()).filter(Boolean))]);
const required = (v: string, label: string) => {
  if (!v.trim()) throw new Error(`${label} is required`);
  return v.trim();
};

export interface CuratedKnowledgeItem {
  id: string;
  kind: CuratedKnowledgeKind;
  title: string;
  description: string;
  version: number;
  domain: string;
  scope: KnowledgeScopeDimension;
  tags: readonly string[];
  signals: readonly string[];
  counterSignals: readonly string[];
  preconditions: readonly string[];
  requiredEvidence: readonly string[];
  candidateSolutions: readonly string[];
  risks: readonly string[];
  controls: readonly string[];
  rejectionConditions: readonly string[];
  failureModes: readonly string[];
  qualityStatus: KnowledgeQualityStatus;
  provenanceCategory: ProvenanceCategory;
  provenanceSource: string;
  limitations: readonly string[];
  applicability: readonly string[];
  knownCounterExamples: readonly string[];
}

export class CuratedKnowledgeRecord {
  readonly item: CuratedKnowledgeItem;
  constructor(input: CuratedKnowledgeItem) {
    if (!input.id || !input.title || !input.description)
      throw new Error("Knowledge identity and description are required");
    if (!Number.isInteger(input.version) || input.version < 1)
      throw new Error("Knowledge version must be positive");
    if (!input.signals.length && input.kind !== "CAPABILITY" && input.kind !== "BENCHMARK_TEMPLATE")
      throw new Error("Curated pattern requires signals");
    if (!input.requiredEvidence.length && input.kind === "PROCESS_PATTERN")
      throw new Error("Pattern requires evidence requirements");
    if (
      !input.provenanceSource ||
      (input.provenanceCategory === "SYNTHETIC_TEST" &&
        !input.provenanceSource.includes("synthetic"))
    )
      throw new Error("Provenance is invalid");
    this.item = freeze({
      ...input,
      id: required(input.id, "Knowledge id"),
      title: required(input.title, "Knowledge title"),
      description: required(input.description, "Knowledge description"),
      tags: strings(input.tags),
      signals: strings(input.signals),
      counterSignals: strings(input.counterSignals),
      preconditions: strings(input.preconditions),
      requiredEvidence: strings(input.requiredEvidence),
      candidateSolutions: strings(input.candidateSolutions),
      risks: strings(input.risks),
      controls: strings(input.controls),
      rejectionConditions: strings(input.rejectionConditions),
      failureModes: strings(input.failureModes),
      limitations: strings(input.limitations),
      applicability: strings(input.applicability),
      knownCounterExamples: strings(input.knownCounterExamples),
    });
    freeze(this);
  }
}

export interface KnowledgePackInput {
  packId: string;
  name: string;
  description: string;
  version: number;
  domain: string;
  scope: KnowledgeScopeDimension;
  knowledgeItemIds: readonly string[];
  dependencies?: readonly string[];
  status?: KnowledgePackStatus;
  qualityStatus: KnowledgeQualityStatus;
  provenance: string;
}
export class KnowledgePack {
  readonly packId: string;
  readonly name: string;
  readonly description: string;
  readonly version: number;
  readonly domain: string;
  readonly scope: KnowledgeScopeDimension;
  readonly knowledgeItemIds: readonly string[];
  readonly dependencies: readonly string[];
  readonly status: KnowledgePackStatus;
  readonly qualityStatus: KnowledgeQualityStatus;
  readonly provenance: string;
  constructor(i: KnowledgePackInput) {
    this.packId = required(i.packId, "packId");
    this.name = required(i.name, "pack name");
    this.description = required(i.description, "pack description");
    this.version = i.version;
    this.domain = required(i.domain, "pack domain");
    this.scope = i.scope;
    this.knowledgeItemIds = strings(i.knowledgeItemIds);
    this.dependencies = strings(i.dependencies);
    this.status = i.status ?? "DRAFT";
    this.qualityStatus = i.qualityStatus;
    this.provenance = required(i.provenance, "pack provenance");
    freeze(this);
  }
}

export interface KnowledgeRelationship {
  id: string;
  fromId: string;
  toId: string;
  type: KnowledgeRelationType;
  rationale: string;
}
export interface AntiPatternCheck {
  status: "CLEAR" | "WARNING" | "BLOCKING_ANTI_PATTERN";
  matches: readonly CuratedKnowledgeRecord[];
  rationale: string;
}
export interface KnowledgeQueryInput {
  scope?: KnowledgeScopeDimension;
  signals?: readonly string[];
  causes?: readonly string[];
  opportunityType?: string;
  capabilities?: readonly string[];
  constraints?: readonly string[];
  brainNeed?: string;
}

export class KnowledgeLibraryV2 {
  private readonly records = new Map<string, CuratedKnowledgeRecord>();
  private readonly packs = new Map<string, KnowledgePack>();
  private readonly relationships = new Map<string, KnowledgeRelationship>();
  add(record: CuratedKnowledgeRecord) {
    if (this.records.has(record.item.id)) throw new Error("Duplicate knowledge id");
    this.records.set(record.item.id, record);
    return record;
  }
  addPack(pack: KnowledgePack) {
    if (this.packs.has(`${pack.packId}:${pack.version}`))
      throw new Error("Duplicate knowledge pack version");
    for (const id of pack.knowledgeItemIds)
      if (!this.records.has(id)) throw new Error(`Dangling pack item: ${id}`);
    this.packs.set(`${pack.packId}:${pack.version}`, pack);
    return pack;
  }
  relate(r: KnowledgeRelationship) {
    if (!this.records.has(r.fromId) || !this.records.has(r.toId))
      throw new Error("Dangling relationship");
    if (r.fromId === r.toId && r.type === "PRECEDES") throw new Error("Invalid self precedence");
    this.relationships.set(r.id, freeze({ ...r }));
  }
  get(id: string) {
    return this.records.get(id);
  }
  all() {
    return freeze([...this.records.values()]);
  }
  findByKind(kind: CuratedKnowledgeKind) {
    return freeze([...this.records.values()].filter((r) => r.item.kind === kind));
  }
  findRelevant(input: KnowledgeQueryInput) {
    const terms = new Set(
      [...(input.signals ?? []), ...(input.causes ?? []), ...(input.capabilities ?? [])].map((v) =>
        v.toLowerCase(),
      ),
    );
    return freeze(
      [...this.records.values()]
        .filter((r) => !input.scope || r.item.scope === "GLOBAL" || r.item.scope === input.scope)
        .map((r) => ({ record: r, why: this.why(r, terms, input.brainNeed) }))
        .filter((x) => x.why.length)
        .sort(
          (a, b) => b.why.length - a.why.length || a.record.item.id.localeCompare(b.record.item.id),
        ),
    );
  }
  findRelevantPatterns(input: KnowledgeQueryInput) {
    return this.findRelevant(input).filter((x) => x.record.item.kind === "PROCESS_PATTERN");
  }
  findRootCauseCandidates(input: KnowledgeQueryInput) {
    return this.findRelevant(input).filter((x) => x.record.item.kind === "ROOT_CAUSE_PATTERN");
  }
  findSolutionCandidates(input: KnowledgeQueryInput) {
    return this.findRelevant(input).filter((x) => x.record.item.kind === "SOLUTION_PATTERN");
  }
  findAntiPatterns(input: KnowledgeQueryInput) {
    return this.findRelevant(input).filter((x) => x.record.item.kind === "ANTI_PATTERN");
  }
  findControls(input: KnowledgeQueryInput) {
    return this.findRelevant(input).filter((x) => x.record.item.kind === "CONTROL_PATTERN");
  }
  findRisks(input: KnowledgeQueryInput) {
    return this.findRelevant(input).filter((x) => x.record.item.kind === "RISK_PATTERN");
  }
  findCapabilities(input: KnowledgeQueryInput) {
    return this.findRelevant(input).filter((x) => x.record.item.kind === "CAPABILITY");
  }
  findRelatedKnowledge(id: string) {
    return freeze(
      [...this.relationships.values()]
        .filter((r) => r.fromId === id || r.toId === id)
        .map((r) => this.records.get(r.fromId === id ? r.toId : r.fromId))
        .filter((x): x is CuratedKnowledgeRecord => Boolean(x)),
    );
  }
  checkAntiPatterns(input: KnowledgeQueryInput): AntiPatternCheck {
    const matches = this.findAntiPatterns(input).map((x) => x.record);
    const blocking = matches.filter((m) =>
      m.item.rejectionConditions.some((c) => (input.constraints ?? []).includes(c)),
    );
    return freeze({
      status: blocking.length ? "BLOCKING_ANTI_PATTERN" : matches.length ? "WARNING" : "CLEAR",
      matches: freeze(blocking.length ? blocking : matches),
      rationale: blocking.length
        ? "A curated anti-pattern has a blocking condition"
        : matches.length
          ? "Potential anti-pattern requires review"
          : "No anti-pattern matched",
    });
  }
  listRelationships() {
    return freeze([...this.relationships.values()]);
  }
  private why(r: CuratedKnowledgeRecord, terms: Set<string>, need?: string) {
    const values = [
      ...r.item.signals,
      ...r.item.tags,
      ...r.item.preconditions,
      ...r.item.applicability,
    ].map((v) => v.toLowerCase());
    const matches = [...terms].filter((t) => values.some((v) => v.includes(t)));
    return need && r.item.controls.some((c) => c.toLowerCase().includes(need.toLowerCase()))
      ? [...matches, `brain need: ${need}`]
      : matches;
  }
}

const base = (
  id: string,
  kind: CuratedKnowledgeKind,
  title: string,
  signals: string[],
  extra: Partial<CuratedKnowledgeItem> = {},
) =>
  new CuratedKnowledgeRecord({
    id,
    kind,
    title,
    description: `Generic curated knowledge: ${title}`,
    version: 1,
    domain: "cross-sector",
    scope: "GLOBAL",
    tags: signals,
    signals,
    counterSignals: [],
    preconditions: [],
    requiredEvidence: kind === "PROCESS_PATTERN" ? ["observed process signal"] : [],
    candidateSolutions: [],
    risks: [],
    controls: [],
    rejectionConditions: [],
    failureModes: [],
    qualityStatus: "REVIEWED",
    provenanceCategory: "EXPERT_CURATED",
    provenanceSource: "internal-curated-v2",
    limitations: ["Candidate knowledge, not company evidence"],
    applicability: signals,
    knownCounterExamples: [],
    ...extra,
  });

export function createGlobalKnowledgePackV2() {
  const library = new KnowledgeLibraryV2();
  const process = [
    "manual-data-reentry",
    "repeated-reconciliation",
    "approval-bottleneck",
    "excessive-handoffs",
    "duplicate-validation",
    "queue-accumulation",
    "unstructured-intake",
    "email-driven-workflow",
    "spreadsheet-dependency",
    "single-person-dependency",
    "manual-routing",
    "manual-status-tracking",
    "fragmented-source-of-truth",
    "delayed-synchronization",
    "repeated-exception-handling",
    "high-rework-loop",
    "manual-document-processing",
    "context-loss-between-teams",
    "repeated-copy-paste",
    "batch-where-event-driven",
  ].map((id) => library.add(base(id, "PROCESS_PATTERN", id.replaceAll("-", " "), id.split("-"))));
  const causes = [
    "poor-master-data",
    "unclear-ownership",
    "missing-upstream-validation",
    "process-not-standardized",
    "system-fragmentation",
    "missing-integration",
    "excessive-exception-paths",
    "missing-source-of-truth",
    "insufficient-observability",
    "stale-information",
  ]
    .slice(0, 8)
    .map((id) =>
      library.add(
        base(id, "ROOT_CAUSE_PATTERN", id.replaceAll("-", " "), id.split("-"), {
          requiredEvidence: ["observed signal", "alternative explanation checked"],
          rejectionConditions: ["root cause unconfirmed"],
        }),
      ),
    );
  const anti = [
    "AUTOMATE_A_BROKEN_PROCESS",
    "AI_WITHOUT_VALIDATION",
    "AUTOMATION_WITHOUT_SOURCE_OF_TRUTH",
    "FULL_AUTOMATION_OF_MANDATORY_CONTROL",
    "AUTOMATE_EXTREMELY_LOW_VOLUME",
    "UNOBSERVABLE_AUTOMATION",
    "AUTOMATION_WITHOUT_FAILURE_PATH",
    "AUTOMATION_WITHOUT_ROLLBACK",
  ]
    .slice(0, 6)
    .map((id) =>
      library.add(
        base(id, "ANTI_PATTERN", id.replaceAll("_", " "), id.toLowerCase().split("_"), {
          risks: ["uncontrolled outcome"],
          controls: ["human review", "observability", "rollback"],
          rejectionConditions: ["process ownership unknown", "mandatory control", "low volume"],
        }),
      ),
    );
  const solutions = [
    "api-synchronization",
    "event-driven-integration",
    "structured-intake",
    "document-extraction-validation",
    "human-in-loop-classification",
    "approval-workflow",
    "queue-based-processing",
    "data-validation-gateway",
    "automated-reconciliation",
    "notification-orchestration",
    "exception-queue",
    "retry-dead-letter",
    "audit-log-pattern",
    "rule-engine-decision",
    "observability-wrapper",
  ]
    .slice(0, 12)
    .map((id) =>
      library.add(
        base(id, "SOLUTION_PATTERN", id.replaceAll("-", " "), id.split("-"), {
          requiredEvidence: ["problem signal"],
          failureModes: ["timeout", "partial write", "invalid input"],
          controls: ["authorization check", "audit logging"],
        }),
      ),
    );
  const capabilities = [
    "READ_DATA",
    "WRITE_DATA",
    "SEARCH_DATA",
    "WEBHOOK",
    "EVENT_SUBSCRIPTION",
    "SCHEDULE",
    "DOCUMENT_EXTRACTION",
    "HUMAN_APPROVAL",
    "MANUAL_REVIEW",
    "RULE_EVALUATION",
    "QUEUE",
    "RETRY",
    "AUDIT_LOG",
    "SECRET_ACCESS",
    "ROLE_CHECK",
    "METRIC_EMIT",
    "ALERT",
  ]
    .slice(0, 10)
    .map((id) =>
      library.add(
        base(id, "CAPABILITY", id.replaceAll("_", " "), [id.toLowerCase()], {
          requiredEvidence: [],
        }),
      ),
    );
  const pack = new KnowledgePack({
    packId: "global-core",
    name: "Global Core",
    description: "Cross-sector curated knowledge foundation",
    version: 1,
    domain: "cross-sector",
    scope: "GLOBAL",
    knowledgeItemIds: [...process, ...causes, ...anti, ...solutions, ...capabilities].map(
      (x) => x.item.id,
    ),
    status: "ACTIVE",
    qualityStatus: "REVIEWED",
    provenance: "internal-curated-v2",
  });
  library.addPack(pack);
  library.relate({
    id: "rel-master-reconcile",
    fromId: "poor-master-data",
    toId: "repeated-reconciliation",
    type: "CAUSES",
    rationale: "Candidate causal relationship",
  });
  library.relate({
    id: "rel-data-api",
    fromId: "data-validation-gateway",
    toId: "api-synchronization",
    type: "PRECEDES",
    rationale: "Validation should precede synchronization",
  });
  library.relate({
    id: "rel-source-anti",
    fromId: "fragmented-source-of-truth",
    toId: "AUTOMATION_WITHOUT_SOURCE_OF_TRUTH",
    type: "CONFLICTS_WITH",
    rationale: "Source-of-truth risk",
  });
  return freeze({ library, pack });
}
