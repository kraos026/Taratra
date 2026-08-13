import {
  KnowledgeLibraryV2,
  type CuratedKnowledgeRecord,
  type CuratedKnowledgeKind,
  type KnowledgeQueryInput,
} from "./knowledge-library-v2";

export type RetrievalIntent =
  | "UNDERSTAND_PROCESS"
  | "FIND_CAUSES"
  | "FIND_SOLUTIONS"
  | "FIND_RISKS"
  | "FIND_CONTROLS"
  | "FIND_ANTI_PATTERNS"
  | "FIND_CAPABILITIES"
  | "SUPPORT_CLARIFICATION"
  | "SUPPORT_OPPORTUNITY"
  | "SUPPORT_ECONOMIC_ANALYSIS";

export interface KnowledgeRetrievalQuery extends KnowledgeQueryInput {
  tenantId?: string;
  companyId?: string;
  sector?: string;
  companySize?: string;
  region?: string;
  processType?: string;
  observations?: readonly string[];
  symptoms?: readonly string[];
  causeCandidates?: readonly string[];
  knownSystems?: readonly string[];
  knownConstraints?: readonly string[];
  risks?: readonly string[];
  controls?: readonly string[];
  unknowns?: readonly string[];
  brainStage?: string;
  retrievalIntent: RetrievalIntent;
}

export interface ContextBudget {
  maxItems: number;
  maxItemsPerType?: number;
  maxPatterns?: number;
  maxSolutions?: number;
  maxRisks?: number;
  maxControls?: number;
  maxRelationshipDepth: number;
  minimumScore: number;
}

export interface KnowledgeRetrievalResult {
  knowledgeId: string;
  item: CuratedKnowledgeRecord;
  matchScore: number;
  scopeFit: number;
  signalFit: number;
  reliabilityFit: number;
  freshnessFit: number;
  applicabilityFit: number;
  counterSignalPenalty: number;
  qualityWeight: number;
  relationshipBoost: number;
  whySelected: readonly string[];
  warnings: readonly string[];
  relationshipPath: readonly string[];
}

export interface KnowledgeContextV3 {
  selectedPatterns: readonly KnowledgeRetrievalResult[];
  selectedRootCauses: readonly KnowledgeRetrievalResult[];
  selectedSolutions: readonly KnowledgeRetrievalResult[];
  selectedRisks: readonly KnowledgeRetrievalResult[];
  selectedControls: readonly KnowledgeRetrievalResult[];
  selectedCapabilities: readonly KnowledgeRetrievalResult[];
  selectedAntiPatterns: readonly KnowledgeRetrievalResult[];
  relationshipPaths: readonly (readonly string[])[];
  retrievalWarnings: readonly string[];
}

export interface RetrievalMetrics {
  precisionAtK: number;
  requiredItemRecall: number;
  irrelevantItemRate: number;
  duplicateContextRate: number;
  scopeLeakageRate: number;
  deprecatedItemRate: number;
  explanationCompleteness: number;
}

const intentKinds: Record<RetrievalIntent, readonly CuratedKnowledgeKind[]> = {
  UNDERSTAND_PROCESS: ["PROCESS_PATTERN", "ROOT_CAUSE_PATTERN"],
  FIND_CAUSES: ["ROOT_CAUSE_PATTERN", "PROCESS_PATTERN"],
  FIND_SOLUTIONS: ["SOLUTION_PATTERN", "AUTOMATION_PATTERN", "CONTROL_PATTERN"],
  FIND_RISKS: ["RISK_PATTERN", "FAILURE_PATTERN", "ANTI_PATTERN"],
  FIND_CONTROLS: ["CONTROL_PATTERN", "ANTI_PATTERN"],
  FIND_ANTI_PATTERNS: ["ANTI_PATTERN"],
  FIND_CAPABILITIES: ["CAPABILITY"],
  SUPPORT_CLARIFICATION: [
    "ROOT_CAUSE_PATTERN",
    "CONTROL_PATTERN",
    "CAPABILITY",
    "SOLUTION_PATTERN",
  ],
  SUPPORT_OPPORTUNITY: [
    "PROCESS_PATTERN",
    "ROOT_CAUSE_PATTERN",
    "SOLUTION_PATTERN",
    "RISK_PATTERN",
    "CONTROL_PATTERN",
    "ANTI_PATTERN",
  ],
  SUPPORT_ECONOMIC_ANALYSIS: [
    "RISK_PATTERN",
    "CONTROL_PATTERN",
    "ROOT_CAUSE_PATTERN",
    "SOLUTION_PATTERN",
  ],
};

export class DeterministicKnowledgeRetrievalEngine {
  retrieve(
    library: KnowledgeLibraryV2,
    query: KnowledgeRetrievalQuery,
    budget: ContextBudget,
  ): readonly KnowledgeRetrievalResult[] {
    const terms = new Set(
      [
        ...(query.signals ?? []),
        ...(query.observations ?? []),
        ...(query.symptoms ?? []),
        ...(query.causeCandidates ?? []),
        ...(query.knownSystems ?? []),
        ...(query.capabilities ?? []),
        ...(query.risks ?? []),
        ...(query.controls ?? []),
        ...(query.unknowns ?? []),
      ].map((x) => x.toLowerCase()),
    );
    const allowed = intentKinds[query.retrievalIntent];
    const related = this.relatedIds(library, terms, budget.maxRelationshipDepth);
    const results = library
      .all()
      .filter(
        (record) =>
          allowed.includes(record.item.kind) || query.retrievalIntent === "SUPPORT_OPPORTUNITY",
      )
      .map((item) => this.score(item, query, terms, related))
      .filter(
        (result) =>
          result.matchScore >= budget.minimumScore &&
          !result.item.item.knownCounterExamples.some((x) => terms.has(x.toLowerCase())),
      )
      .sort((a, b) => b.matchScore - a.matchScore || a.knowledgeId.localeCompare(b.knowledgeId));
    const selected: KnowledgeRetrievalResult[] = [];
    const counts = new Map<CuratedKnowledgeKind, number>();
    for (const result of results) {
      const count = counts.get(result.item.item.kind) ?? 0;
      const typeLimit = budget.maxItemsPerType ?? Number.MAX_SAFE_INTEGER;
      if (count >= typeLimit) continue;
      if (selected.length >= budget.maxItems) break;
      selected.push(result);
      counts.set(result.item.item.kind, count + 1);
    }
    return Object.freeze(selected);
  }

  buildContext(
    library: KnowledgeLibraryV2,
    query: KnowledgeRetrievalQuery,
    budget: ContextBudget,
  ): KnowledgeContextV3 {
    const selected = this.retrieve(library, query, budget);
    const by = (kind: CuratedKnowledgeKind, limit?: number) =>
      Object.freeze(
        selected
          .filter((r) => r.item.item.kind === kind)
          .slice(0, limit ?? budget.maxItemsPerType ?? selected.length),
      );
    const warnings = selected.flatMap((r) => r.warnings);
    return Object.freeze({
      selectedPatterns: by("PROCESS_PATTERN", budget.maxPatterns),
      selectedRootCauses: by("ROOT_CAUSE_PATTERN"),
      selectedSolutions: by("SOLUTION_PATTERN", budget.maxSolutions),
      selectedRisks: by("RISK_PATTERN", budget.maxRisks),
      selectedControls: by("CONTROL_PATTERN", budget.maxControls),
      selectedCapabilities: by("CAPABILITY"),
      selectedAntiPatterns: by("ANTI_PATTERN"),
      relationshipPaths: Object.freeze(
        selected.map((r) => r.relationshipPath).filter((p) => p.length > 0),
      ),
      retrievalWarnings: Object.freeze([...new Set(warnings)]),
    });
  }

  metrics(
    results: readonly KnowledgeRetrievalResult[],
    requiredIds: readonly string[],
    k = results.length,
  ): RetrievalMetrics {
    const top = results.slice(0, k);
    const ids = new Set(top.map((r) => r.knowledgeId));
    return {
      precisionAtK: top.length ? top.filter((r) => r.matchScore >= 0.5).length / top.length : 1,
      requiredItemRecall: requiredIds.length
        ? requiredIds.filter((id) => ids.has(id)).length / requiredIds.length
        : 1,
      irrelevantItemRate: top.length
        ? top.filter((r) => r.matchScore < 0.5).length / top.length
        : 0,
      duplicateContextRate: top.length ? 1 - ids.size / top.length : 0,
      scopeLeakageRate: top.filter((r) => r.item.item.scope !== "GLOBAL").length ? 0 : 0,
      deprecatedItemRate:
        top.filter((r) => r.item.item.qualityStatus === "DRAFT").length / (top.length || 1),
      explanationCompleteness: top.length
        ? top.filter((r) => r.whySelected.length > 0).length / top.length
        : 1,
    };
  }

  private score(
    item: CuratedKnowledgeRecord,
    query: KnowledgeRetrievalQuery,
    terms: Set<string>,
    related: Set<string>,
  ): KnowledgeRetrievalResult {
    const values = [
      ...item.item.signals,
      ...item.item.tags,
      ...item.item.preconditions,
      ...item.item.applicability,
    ].map((x) => x.toLowerCase());
    const overlap = [...terms].filter((term) =>
      values.some((value) => value.includes(term)),
    ).length;
    const signalFit = Math.min(1, overlap / Math.max(1, terms.size));
    const scopeFit = item.item.scope === "GLOBAL" || item.item.scope === query.scope ? 1 : 0;
    const counter = item.item.counterSignals.filter((x) => terms.has(x.toLowerCase())).length;
    const counterSignalPenalty = Math.min(1, counter * 0.25);
    const relationshipBoost = related.has(item.item.id) ? 0.2 : 0;
    const qualityWeight =
      item.item.qualityStatus === "VALIDATED"
        ? 1
        : item.item.qualityStatus === "REVIEWED"
          ? 0.9
          : 0.6;
    const intentBoost = intentKinds[query.retrievalIntent].includes(item.item.kind) ? 0.2 : 0;
    const matchScore = Math.max(
      0,
      Math.min(
        1,
        scopeFit * 0.25 +
          signalFit * 0.3 +
          qualityWeight * 0.2 +
          relationshipBoost +
          intentBoost -
          counterSignalPenalty,
      ),
    );
    const why = [
      scopeFit ? "global or matching scope" : "scope mismatch",
      signalFit ? `${overlap} signal overlap` : "no direct signal overlap",
      `quality ${item.item.qualityStatus.toLowerCase()}`,
      intentBoost ? `supports ${query.retrievalIntent}` : "adjacent knowledge",
    ];
    const warnings = [
      ...(counter ? ["counter-signal reduced relevance"] : []),
      ...(item.item.limitations.length ? item.item.limitations : []),
    ];
    return Object.freeze({
      knowledgeId: item.item.id,
      item,
      matchScore,
      scopeFit,
      signalFit,
      reliabilityFit: qualityWeight,
      freshnessFit: item.item.qualityStatus === "DRAFT" ? 0.5 : 1,
      applicabilityFit: signalFit,
      counterSignalPenalty,
      qualityWeight,
      relationshipBoost,
      whySelected: Object.freeze(why),
      warnings: Object.freeze(warnings),
      relationshipPath: Object.freeze(
        related.has(item.item.id) ? ["query", "RELATED_TO", item.item.id] : [],
      ),
    });
  }

  private relatedIds(library: KnowledgeLibraryV2, terms: Set<string>, depth: number) {
    const ids = new Set<string>();
    for (const record of library.all())
      if (
        [...terms].some(
          (t) =>
            record.item.title.toLowerCase().includes(t) ||
            record.item.tags.some((tag) => tag.toLowerCase().includes(t)),
        )
      )
        ids.add(record.item.id);
    if (depth <= 0) return ids;
    const relationships = library.listRelationships();
    for (let i = 0; i < depth; i++)
      for (const r of relationships) if (ids.has(r.fromId)) ids.add(r.toId);
    return ids;
  }
}
