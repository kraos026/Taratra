export type ValidationSeverity = "error" | "warning" | "information";
export type GraphNodeType =
  "process" | "step" | "decision" | "document" | "actor" | "system" | "event" | "input" | "output";
export type GraphEdgeType =
  "produces" | "consumes" | "uses" | "sends" | "approves" | "transfers" | "depends_on" | "triggers";

export interface KnowledgeFactInput {
  id: string;
  key: string;
  domain: string;
  value: unknown;
  confidence: number;
}
export interface KnowledgeNodeInput {
  id: string;
  key: string;
  type: string;
  domain: string;
  label: string;
  confidence: number;
}
export interface PatternFact {
  match: string;
  weight: number;
}
export interface ProcessPatternInput {
  id: string;
  code: string;
  version: number;
  name: string;
  industryScope: string[];
  requiredFacts: PatternFact[];
  optionalFacts: PatternFact[];
  validationRules: { code: string; severity: ValidationSeverity }[];
  graphTemplate: {
    nodes: { key: string; type: GraphNodeType; name: string; description?: string }[];
    edges: [string, string, GraphEdgeType][];
  };
}
export interface ProcessValidation {
  code: string;
  severity: ValidationSeverity;
  message: string;
  nodeKey?: string;
}
export interface ProcessBuild {
  pattern: ProcessPatternInput;
  selectionReasons: string[];
  nodes: {
    key: string;
    type: GraphNodeType;
    name: string;
    description?: string;
    sequence: number;
    executionMode?: string | null;
    estimatedDurationMinutes?: number | null;
    actorKnowledgeNodeId?: string | null;
    departmentKnowledgeNodeId?: string | null;
    systemKnowledgeNodeId?: string | null;
    frequency?: string | null;
    knowledgeFactIds?: string[];
    attributes?: Record<string, unknown>;
  }[];
  edges: { from: string; to: string; type: GraphEdgeType }[];
  ownership: {
    ownerNodeId: string | null;
    departmentNodeId: string | null;
    participantNodeIds: string[];
    systemNodeIds: string[];
  };
  consumedFacts: { fact: KnowledgeFactInput; weight: number; reason: string }[];
  ignoredFacts: { fact: KnowledgeFactInput; reason: string }[];
  validations: ProcessValidation[];
  completeness: number;
  confidence: number;
  coverage: number;
  ready: boolean;
}

export class ProcessMappingEngine {
  build(
    patterns: ProcessPatternInput[],
    facts: KnowledgeFactInput[],
    knowledgeNodes: KnowledgeNodeInput[],
  ): ProcessBuild[] {
    return this.findProcesses(patterns, facts, knowledgeNodes).map((pattern) =>
      this.buildPattern(pattern, facts, knowledgeNodes),
    );
  }

  rebuild(pattern: ProcessPatternInput, facts: KnowledgeFactInput[], nodes: KnowledgeNodeInput[]) {
    return this.buildPattern(pattern, facts, nodes);
  }

  findProcesses(
    patterns: ProcessPatternInput[],
    facts: KnowledgeFactInput[],
    nodes: KnowledgeNodeInput[],
  ) {
    const searchable = [...facts.map(searchFact), ...nodes.map(searchNode)];
    const industry = facts.find((fact) => fact.key === "company.industry");
    const industryValue = typeof industry?.value === "string" ? industry.value : null;
    return patterns
      .filter(
        (pattern) =>
          (pattern.industryScope.length === 0 ||
            (industryValue !== null &&
              pattern.industryScope.some((scope) =>
                industryValue.toLowerCase().includes(scope.toLowerCase()),
              ))) &&
          pattern.requiredFacts.some((rule) => matches(searchable, rule.match)),
      )
      .sort((left, right) => left.code.localeCompare(right.code));
  }

  findSteps(build: ProcessBuild) {
    return build.nodes.filter((node) => ["step", "decision"].includes(node.type));
  }

  findActors(nodes: KnowledgeNodeInput[]) {
    return nodes.filter((node) => ["role", "actor"].includes(node.type));
  }

  findSystems(nodes: KnowledgeNodeInput[]) {
    return nodes.filter((node) => node.type === "software");
  }

  findDocuments(nodes: KnowledgeNodeInput[]) {
    return nodes.filter((node) => node.type === "document");
  }

  detectDependencies(build: ProcessBuild) {
    return build.edges.filter((edge) => edge.type === "depends_on");
  }

  calculateCompleteness(
    nodes: ProcessBuild["nodes"],
    edges: ProcessBuild["edges"],
    ownership: ProcessBuild["ownership"],
    knowledgeNodes: KnowledgeNodeInput[],
  ) {
    const incoming = new Set(edges.map((edge) => edge.to));
    const outgoing = new Set(edges.map((edge) => edge.from));
    const starts = nodes.filter((node) => !incoming.has(node.key));
    const ends = nodes.filter((node) => !outgoing.has(node.key));
    const connected = nodes.every(
      (node) =>
        starts.some((start) => start.key === node.key) ||
        ends.some((end) => end.key === node.key) ||
        (incoming.has(node.key) && outgoing.has(node.key)),
    );
    const actors = this.findActors(knowledgeNodes);
    const systems = this.findSystems(knowledgeNodes);
    const score =
      (starts.length > 0 ? 15 : 0) +
      (ends.length > 0 ? 15 : 0) +
      (connected ? 20 : 0) +
      (ownership.ownerNodeId && ownership.departmentNodeId ? 15 : 0) +
      (actors.length > 0 ? 10 : 0) +
      (systems.length > 0 ? 10 : 0) +
      (nodes.some((node) => node.type === "input") && nodes.some((node) => node.type === "output")
        ? 10
        : 0) +
      (nodes.every((node) => node.name.trim().length > 0) ? 5 : 0);
    return score;
  }

  validate(
    nodes: ProcessBuild["nodes"],
    edges: ProcessBuild["edges"],
    ownership: ProcessBuild["ownership"],
    knowledgeNodes: KnowledgeNodeInput[],
  ): ProcessValidation[] {
    const validations: ProcessValidation[] = [];
    const incoming = new Set(edges.map((edge) => edge.to));
    const outgoing = new Set(edges.map((edge) => edge.from));
    if (!nodes.some((node) => !incoming.has(node.key)))
      validations.push({ code: "missing_start", severity: "error", message: "Missing start" });
    if (!nodes.some((node) => !outgoing.has(node.key)))
      validations.push({ code: "missing_end", severity: "error", message: "Missing end" });
    for (const node of nodes)
      if (incoming.has(node.key) !== outgoing.has(node.key) && edges.length > 0) continue;
      else if (edges.length > 0 && incoming.has(node.key) && outgoing.has(node.key)) continue;
      else if (nodes.length > 1)
        validations.push({
          code: "orphan_activity",
          severity: "error",
          message: "Disconnected activity",
          nodeKey: node.key,
        });
    const names = new Set<string>();
    for (const node of nodes) {
      const normalized = node.name.trim().toLowerCase();
      if (names.has(normalized))
        validations.push({
          code: "duplicate_activity",
          severity: "warning",
          message: "Duplicate activity",
          nodeKey: node.key,
        });
      names.add(normalized);
    }
    if (hasCycle(nodes, edges))
      validations.push({ code: "cycle", severity: "warning", message: "Cycle detected" });
    if (!ownership.ownerNodeId)
      validations.push({ code: "missing_owner", severity: "error", message: "Missing owner" });
    if (this.findActors(knowledgeNodes).length === 0)
      validations.push({ code: "missing_actor", severity: "error", message: "Missing actor" });
    if (this.findSystems(knowledgeNodes).length === 0)
      validations.push({
        code: "missing_system",
        severity: "warning",
        message: "Missing supporting system",
      });
    if (validations.length === 0)
      validations.push({
        code: "valid_graph",
        severity: "information",
        message: "Graph validation passed",
      });
    return validations;
  }

  private buildPattern(
    pattern: ProcessPatternInput,
    facts: KnowledgeFactInput[],
    knowledgeNodes: KnowledgeNodeInput[],
  ): ProcessBuild {
    const rules = [...pattern.requiredFacts, ...pattern.optionalFacts];
    const relevant = facts
      .map((fact) => {
        const matched = rules.filter((rule) => matches([searchFact(fact)], rule.match));
        return { fact, matched, weight: Math.max(0, ...matched.map((rule) => rule.weight)) };
      })
      .filter((item) => item.matched.length > 0);
    const consumedFacts = relevant.map(({ fact, weight, matched }) => ({
      fact,
      weight,
      reason: `Matched pattern terms: ${matched.map((rule) => rule.match).join(", ")}`,
    }));
    const ignoredFacts = facts
      .filter((fact) => !relevant.some((item) => item.fact.id === fact.id))
      .map((fact) => ({ fact, reason: "Not relevant to selected pattern" }));
    const nodes = this.enrichExecutionMetadata(
      pattern,
      pattern.graphTemplate.nodes.map((node, sequence) => ({
        ...node,
        sequence,
        executionMode: null,
        estimatedDurationMinutes: null,
        actorKnowledgeNodeId: null,
        departmentKnowledgeNodeId: null,
        systemKnowledgeNodeId: null,
        frequency: null,
        knowledgeFactIds: [],
        attributes: {},
      })),
      facts,
      knowledgeNodes,
    );
    const edges = pattern.graphTemplate.edges.map(([from, to, type]) => ({ from, to, type }));
    const departments = knowledgeNodes.filter((node) => node.type === "department");
    const actors = this.findActors(knowledgeNodes);
    const systems = this.findSystems(knowledgeNodes);
    const ownership = {
      ownerNodeId: actors[0]?.id ?? null,
      departmentNodeId: departments[0]?.id ?? null,
      participantNodeIds: actors.map((node) => node.id),
      systemNodeIds: systems.map((node) => node.id),
    };
    const validationSeverity = new Map(
      pattern.validationRules.map((rule) => [rule.code, rule.severity]),
    );
    const validations = this.validate(nodes, edges, ownership, knowledgeNodes).map(
      (validation) => ({
        ...validation,
        severity:
          validationSeverity.get(validation.code) ??
          validationSeverity.get(validation.code.replace("missing_", "")) ??
          validation.severity,
      }),
    );
    const completeness = this.calculateCompleteness(nodes, edges, ownership, knowledgeNodes);
    const totalRelevantWeight = relevant.reduce((total, item) => total + item.weight, 0);
    const consumedWeight = consumedFacts.reduce((total, item) => total + item.weight, 0);
    const coverage =
      totalRelevantWeight === 0 ? 0 : round((consumedWeight / totalRelevantWeight) * 100);
    const confidence =
      consumedWeight === 0
        ? 0
        : round(
            consumedFacts.reduce((total, item) => total + item.fact.confidence * item.weight, 0) /
              consumedWeight,
          );
    const ready =
      !validations.some((validation) => validation.severity === "error") &&
      completeness >= 80 &&
      confidence >= 80 &&
      coverage >= 70;
    return {
      pattern,
      selectionReasons: consumedFacts.map((item) => item.reason),
      nodes,
      edges,
      ownership,
      consumedFacts,
      ignoredFacts,
      validations,
      completeness,
      confidence,
      coverage,
      ready,
    };
  }

  private enrichExecutionMetadata(
    pattern: ProcessPatternInput,
    nodes: ProcessBuild["nodes"],
    facts: KnowledgeFactInput[],
    knowledgeNodes: KnowledgeNodeInput[],
  ): ProcessBuild["nodes"] {
    if (pattern.code !== "invoice_processing") return nodes;
    const executionModeFact = facts.find((fact) => fact.key === "interview.finance.invoice_mode");
    const manualHoursFact = facts.find((fact) => /manual_hours_month$/.test(fact.key));
    const invoiceTimeFact = facts.find((fact) => fact.key === "interview.finance.invoice_time");
    const frequencyFact = facts.find((fact) => /\.frequency$/.test(fact.key));
    const ownerFact = facts.find((fact) => fact.key === "interview.finance.invoice_owner");
    const executionMode = normalizeExecutionMode(executionModeFact?.value);
    if (executionMode !== "manual") return nodes;
    const manualMinutesMonthly = hoursToMinutes(manualHoursFact?.value);
    const fallbackMinutes = minutes(invoiceTimeFact?.value);
    const targetNodes = nodes.filter((node) => isInvoiceManualNode(node));
    if (targetNodes.length === 0) return nodes;
    const perNodeMonthlyMinutes =
      manualMinutesMonthly !== null ? round(manualMinutesMonthly / targetNodes.length) : null;
    const actorNode = resolveSingleActor(ownerFact, knowledgeNodes);
    const departmentNode = knowledgeNodes.find((node) => node.type === "department") ?? null;
    const lineage = [
      executionModeFact?.id,
      manualHoursFact?.id,
      invoiceTimeFact?.id,
      frequencyFact?.id,
      ownerFact?.id,
    ].filter(isString);
    const projectedFrequency =
      typeof frequencyFact?.value === "string" ? frequencyFact.value : null;

    return nodes.map((node) => {
      if (!targetNodes.some((target) => target.key === node.key)) return node;
      const ambiguousActor = ownerFact !== undefined && actorNode === null;
      return {
        ...node,
        executionMode,
        estimatedDurationMinutes: perNodeMonthlyMinutes ?? fallbackMinutes,
        actorKnowledgeNodeId: actorNode?.id ?? null,
        departmentKnowledgeNodeId: departmentNode?.id ?? null,
        frequency: projectedFrequency,
        knowledgeFactIds: lineage,
        attributes: {
          ...node.attributes,
          executionMetadataProjection: {
            status: ambiguousActor ? "AMBIGUOUS" : "AUTO_PROJECTED",
            durationSemantic:
              perNodeMonthlyMinutes !== null
                ? "allocated_monthly_manual_workload_minutes"
                : "per_execution_minutes",
            source: "knowledge",
            requiresHumanValidation: ambiguousActor,
          },
        },
      };
    });
  }
}

function normalizeExecutionMode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "manual") return "manual";
  if (normalized === "automatic" || normalized === "automated") return "automated";
  return null;
}

function hoursToMinutes(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return round(value * 60);
}

function minutes(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return round(value);
}

function isInvoiceManualNode(node: ProcessBuild["nodes"][number]) {
  return ["receive", "validate", "account", "approve"].includes(node.key);
}

function resolveSingleActor(
  ownerFact: KnowledgeFactInput | undefined,
  knowledgeNodes: KnowledgeNodeInput[],
) {
  if (!ownerFact || typeof ownerFact.value !== "string") return null;
  const text = ownerFact.value.toLowerCase();
  const actors = knowledgeNodes.filter((node) => ["role", "actor"].includes(node.type));
  const matches = actors.filter((node) => text.includes(node.label.toLowerCase()));
  return matches.length === 1 ? matches[0]! : null;
}

function isString(value: string | undefined): value is string {
  return typeof value === "string";
}

function searchFact(fact: KnowledgeFactInput) {
  return `${fact.key} ${fact.domain} ${JSON.stringify(fact.value)}`.toLowerCase();
}
function searchNode(node: KnowledgeNodeInput) {
  return `${node.key} ${node.type} ${node.domain} ${node.label}`.toLowerCase();
}
function matches(values: string[], term: string) {
  return values.some((value) => value.includes(term.toLowerCase()));
}
function round(value: number) {
  return Math.round(value * 100) / 100;
}
function hasCycle(nodes: ProcessBuild["nodes"], edges: ProcessBuild["edges"]) {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const adjacency = new Map<string, string[]>();
  for (const edge of edges)
    adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);
  const visit = (key: string): boolean => {
    if (visiting.has(key)) return true;
    if (visited.has(key)) return false;
    visiting.add(key);
    if ((adjacency.get(key) ?? []).some(visit)) return true;
    visiting.delete(key);
    visited.add(key);
    return false;
  };
  return nodes.some((node) => visit(node.key));
}
