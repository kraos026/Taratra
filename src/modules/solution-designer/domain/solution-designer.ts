export type BlueprintStatus = "draft" | "validated" | "published" | "archived";
export type EdgeType =
  | "produces"
  | "consumes"
  | "calls"
  | "stores"
  | "notifies"
  | "approves"
  | "schedules"
  | "authenticates"
  | "logs"
  | "monitors";

export interface CapabilityDefinition {
  id: string;
  code: string;
  name: string;
  version: number;
  costIndex: number;
  published: boolean;
}
export interface ConnectorDefinition {
  id: string;
  code: string;
  name: string;
  version: number;
  costIndex: number;
  capabilities: string[];
  secrets: string[];
  permissions: string[];
  inputs: string[];
  outputs: string[];
  published: boolean;
}
export interface ConstraintDefinition {
  id: string;
  code: string;
  name: string;
  version: number;
  published: boolean;
}
export interface PatternTemplate {
  components: { code: string; name: string }[];
  capabilities: string[];
  connectors: { code: string; role?: string }[];
  constraints: string[];
  secrets: string[];
  permissions: string[];
  edges: { from: string; to: string; type: EdgeType; label: string }[];
  risks: { name: string; severity: number; costIndex: number }[];
  normalization: {
    componentFactor: number;
    connectorFactor: number;
    dependencyFactor: number;
    constraintFactor: number;
    weights: {
      components: number;
      connectors: number;
      dependencies: number;
      constraints: number;
    };
    complexityCostFactor: number;
    dependencyEdgeTypes: EdgeType[];
  };
}
export interface PatternDefinition {
  id: string;
  code: string;
  name: string;
  version: number;
  recommendationCategories: string[];
  template: PatternTemplate;
  published: boolean;
}
export interface BlueprintSource {
  recommendationId: string;
  recommendationIdentifier: string;
  recommendationTitle: string;
  recommendationDescription: string;
  recommendationCategory: string;
  recommendationStatus: string;
  recommendationSnapshotId: string;
  roiSnapshotId: string;
  roiStatus: string;
  automationOpportunityId: string;
  automationSnapshotId: string;
  automationStatus: string;
  companyId: string;
  evidenceIds: string[];
}
export interface DesignerInput {
  source: BlueprintSource;
  patterns: PatternDefinition[];
  capabilities: CapabilityDefinition[];
  connectors: ConnectorDefinition[];
  constraints: ConstraintDefinition[];
}
export interface BlueprintValidation {
  code: string;
  severity: "error" | "information";
  message: string;
}
export interface BlueprintResult {
  pattern: PatternDefinition | null;
  name: string;
  description: string;
  objective: string;
  architecture: string;
  components: PatternTemplate["components"];
  capabilities: CapabilityDefinition[];
  connectors: (ConnectorDefinition & { role?: string })[];
  constraints: ConstraintDefinition[];
  secrets: string[];
  permissions: string[];
  inputs: string[];
  outputs: string[];
  topology: PatternTemplate["edges"];
  risks: PatternTemplate["risks"];
  finalRisk: number;
  complexityScore: number;
  estimatedTechnicalCostIndex: number;
  evidenceIds: string[];
  validations: BlueprintValidation[];
  catalogVersions: Record<string, { id: string; code: string; version: number }[]>;
}

const forbiddenPlatforms = [
  "n8n",
  "make",
  "zapier",
  "power automate",
  "temporal",
  "camunda",
  "aws step functions",
  "azure logic apps",
  "google workflows",
];

export class SolutionDesigner {
  generate(input: DesignerInput): BlueprintResult {
    const pattern =
      input.patterns.find(
        (item) =>
          item.published &&
          item.recommendationCategories.includes(input.source.recommendationCategory),
      ) ?? null;
    const template = pattern?.template;
    const capabilities = template
      ? template.capabilities
          .map((code) => input.capabilities.find((item) => item.code === code && item.published))
          .filter((item): item is CapabilityDefinition => Boolean(item))
      : [];
    const connectors: (ConnectorDefinition & { role?: string })[] = template
      ? template.connectors.flatMap((reference) => {
          const item = input.connectors.find(
            (candidate) => candidate.code === reference.code && candidate.published,
          );

          return item ? [{ ...item, ...(reference.role ? { role: reference.role } : {}) }] : [];
        })
      : [];
    const constraints = template
      ? template.constraints
          .map((code) => input.constraints.find((item) => item.code === code && item.published))
          .filter((item): item is ConstraintDefinition => Boolean(item))
      : [];
    const complexityScore = template
      ? this.complexity(template, connectors.length, constraints.length)
      : 0;
    const finalRisk =
      template?.risks.reduce((maximum, risk) => Math.max(maximum, risk.severity), 0) ?? 0;
    const estimatedTechnicalCostIndex = template
      ? round(
          capabilities.reduce((sum, item) => sum + item.costIndex, 0) +
            connectors.reduce((sum, item) => sum + item.costIndex, 0) +
            complexityScore * template.normalization.complexityCostFactor +
            (template.risks.find((risk) => risk.severity === finalRisk)?.costIndex ?? 0),
        )
      : 0;
    const result: BlueprintResult = {
      pattern,
      name: pattern
        ? `${pattern.name} — ${input.source.recommendationTitle}`
        : input.source.recommendationTitle,
      description: input.source.recommendationDescription,
      objective: input.source.recommendationTitle,
      architecture: pattern?.name ?? "Unknown",
      components: template?.components ?? [],
      capabilities,
      connectors,
      constraints,
      secrets: template?.secrets ?? [],
      permissions: template?.permissions ?? [],
      inputs: unique(connectors.flatMap((item) => item.inputs)),
      outputs: unique(connectors.flatMap((item) => item.outputs)),
      topology: template?.edges ?? [],
      risks: template?.risks ?? [],
      finalRisk,
      complexityScore,
      estimatedTechnicalCostIndex,
      evidenceIds: input.source.evidenceIds,
      validations: [],
      catalogVersions: {
        patterns: pattern ? [version(pattern)] : [],
        capabilities: capabilities.map(version),
        connectors: connectors.map(version),
        constraints: constraints.map(version),
      },
    };
    result.validations = this.validate(input, result);
    return result;
  }

  rebuild(input: DesignerInput) {
    return this.generate(input);
  }

  validate(input: DesignerInput, result: BlueprintResult): BlueprintValidation[] {
    const errors: BlueprintValidation[] = [];
    const add = (code: string, message: string) =>
      errors.push({ code, severity: "error", message });
    if (!result.pattern) add("unknown_pattern", "Published pattern is required");
    const template = result.pattern?.template;
    if (template && result.capabilities.length !== template.capabilities.length)
      add("unknown_capability", "Every capability must resolve to a published catalog version");
    if (result.capabilities.some((item) => !Number.isFinite(item.costIndex)))
      add("missing_capability_cost", "Every capability requires a cost index");
    if (template && result.connectors.length !== template.connectors.length)
      add("unknown_connector", "Every connector requirement must be published");
    if (result.connectors.some((item) => !Number.isFinite(item.costIndex)))
      add("missing_connector_cost", "Every connector requires a cost index");
    if (template && result.constraints.length !== template.constraints.length)
      add("unknown_constraint", "Every constraint must be published");
    if (template) {
      const known = new Set(result.components.map((item) => item.code));
      const connected = new Set(result.topology.flatMap((edge) => [edge.from, edge.to]));
      if (result.components.some((item) => !connected.has(item.code)))
        add("orphan_component", "Every component must participate in the topology");
      if (result.topology.some((edge) => !known.has(edge.from) || !known.has(edge.to)))
        add("invalid_edge", "Every edge must reference known components");
      if (
        hasCycle(
          result.components.map((item) => item.code),
          result.topology.filter((edge) =>
            template.normalization.dependencyEdgeTypes.includes(edge.type),
          ),
        )
      )
        add("topology_cycle", "Topology cycles are forbidden");
      const connectorSecrets = unique(result.connectors.flatMap((item) => item.secrets));
      const connectorPermissions = unique(result.connectors.flatMap((item) => item.permissions));
      const connectorInputs = unique(result.connectors.flatMap((item) => item.inputs));
      const connectorOutputs = unique(result.connectors.flatMap((item) => item.outputs));
      if (connectorSecrets.some((item) => !result.secrets.includes(item)))
        add("missing_secret", "Every connector secret must be generated");
      if (connectorPermissions.some((item) => !result.permissions.includes(item)))
        add("missing_permission", "Every connector permission must be generated");
      if (connectorInputs.some((item) => !result.inputs.includes(item)) || !result.inputs.length)
        add("missing_input", "Every connector input must be generated");
      if (connectorOutputs.some((item) => !result.outputs.includes(item)) || !result.outputs.length)
        add("missing_output", "Every connector output must be generated");
      if (result.risks.some((risk) => !Number.isFinite(risk.severity)))
        add("missing_risk_severity", "Every risk requires a severity");
    }
    if (!result.evidenceIds.length) add("missing_evidence", "Evidence is required");
    if (input.source.recommendationStatus !== "published")
      add("recommendation_unpublished", "Recommendation must be published");
    if (input.source.roiStatus !== "published") add("roi_unpublished", "ROI must be published");
    if (input.source.automationStatus !== "published")
      add("automation_unpublished", "Automation Opportunity must be published");
    const serialized = JSON.stringify(result).toLowerCase();
    if (forbiddenPlatforms.some((platform) => serialized.includes(platform)))
      add("forbidden_platform", "Blueprint must remain platform-agnostic");
    return errors.length
      ? errors
      : [{ code: "blueprint_valid", severity: "information", message: "Blueprint is valid" }];
  }

  private complexity(template: PatternTemplate, connectorCount: number, constraintCount: number) {
    const n = template.normalization;
    return clamp(
      Math.round(
        clamp(template.components.length * n.componentFactor) * n.weights.components +
          clamp(connectorCount * n.connectorFactor) * n.weights.connectors +
          clamp(template.edges.length * n.dependencyFactor) * n.weights.dependencies +
          clamp(constraintCount * n.constraintFactor) * n.weights.constraints,
      ),
    );
  }
}

const unique = <T>(values: T[]) => [...new Set(values)];
const clamp = (value: number) => Math.min(100, Math.max(0, value));
const round = (value: number) => Math.round(value * 100) / 100;
const version = <T extends { id: string; code: string; version: number }>(item: T) => ({
  id: item.id,
  code: item.code,
  version: item.version,
});
function hasCycle(nodes: string[], edges: PatternTemplate["edges"]) {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (node: string): boolean => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const edge of edges.filter((item) => item.from === node)) if (visit(edge.to)) return true;
    visiting.delete(node);
    visited.add(node);
    return false;
  };
  return nodes.some(visit);
}
