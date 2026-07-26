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
export type ValidationOperator =
  | "pattern_valid"
  | "catalog_references_resolved"
  | "constraints_resolved"
  | "graph_well_formed"
  | "graph_acyclic"
  | "connector_inputs_complete"
  | "connector_outputs_complete"
  | "connector_secrets_complete"
  | "connector_permissions_complete"
  | "evidence_present"
  | "source_published";
export interface ValidationRuleDefinition {
  id: string;
  code: string;
  version: number;
  description: string;
  severity: "error" | "warning" | "information";
  configuration: {
    operator: ValidationOperator;
    source?: "recommendation" | "roi" | "automation";
    forbiddenValues?: string[];
  };
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
  validationRules: ValidationRuleDefinition[];
}
export interface BlueprintValidation {
  code: string;
  severity: "error" | "warning" | "information";
  message: string;
  passed: boolean;
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
        validations: input.validationRules.filter((rule) => rule.published).map(version),
      },
    };
    result.validations = this.validate(input, result);
    return result;
  }

  rebuild(input: DesignerInput) {
    return this.generate(input);
  }

  validate(input: DesignerInput, result: BlueprintResult): BlueprintValidation[] {
    return input.validationRules
      .filter((rule) => rule.published)
      .map((rule) => ({
        code: rule.code,
        severity: rule.severity,
        message: rule.description,
        passed: evaluateValidationOperator(rule, input, result),
      }));
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
function evaluateValidationOperator(
  rule: ValidationRuleDefinition,
  input: DesignerInput,
  result: BlueprintResult,
) {
  const template = result.pattern?.template;
  const connectorValues = {
    secrets: unique(result.connectors.flatMap((item) => item.secrets)),
    permissions: unique(result.connectors.flatMap((item) => item.permissions)),
    inputs: unique(result.connectors.flatMap((item) => item.inputs)),
    outputs: unique(result.connectors.flatMap((item) => item.outputs)),
  };
  switch (rule.configuration.operator) {
    case "pattern_valid": {
      const serialized = JSON.stringify(result).toLowerCase();
      return (
        result.pattern !== null &&
        !(rule.configuration.forbiddenValues ?? []).some((value) =>
          serialized.includes(value.toLowerCase()),
        )
      );
    }
    case "catalog_references_resolved":
      return Boolean(
        template &&
        result.capabilities.length === template.capabilities.length &&
        result.connectors.length === template.connectors.length &&
        result.capabilities.every((item) => Number.isFinite(item.costIndex)) &&
        result.connectors.every((item) => Number.isFinite(item.costIndex)),
      );
    case "constraints_resolved":
      return Boolean(template && result.constraints.length === template.constraints.length);
    case "graph_well_formed": {
      const known = new Set(result.components.map((item) => item.code));
      const connected = new Set(result.topology.flatMap((edge) => [edge.from, edge.to]));
      return (
        result.components.every((item) => connected.has(item.code)) &&
        result.topology.every((edge) => known.has(edge.from) && known.has(edge.to))
      );
    }
    case "graph_acyclic":
      return Boolean(
        template &&
        !hasCycle(
          result.components.map((item) => item.code),
          result.topology.filter((edge) =>
            template.normalization.dependencyEdgeTypes.includes(edge.type),
          ),
        ),
      );
    case "connector_inputs_complete":
      return (
        connectorValues.inputs.length > 0 &&
        connectorValues.inputs.every((item) => result.inputs.includes(item))
      );
    case "connector_outputs_complete":
      return (
        connectorValues.outputs.length > 0 &&
        connectorValues.outputs.every((item) => result.outputs.includes(item))
      );
    case "connector_secrets_complete":
      return connectorValues.secrets.every((item) => result.secrets.includes(item));
    case "connector_permissions_complete":
      return connectorValues.permissions.every((item) => result.permissions.includes(item));
    case "evidence_present":
      return result.evidenceIds.length > 0;
    case "source_published":
      return sourceStatus(input.source, rule.configuration.source) === "published";
  }
}
function sourceStatus(
  source: BlueprintSource,
  key: ValidationRuleDefinition["configuration"]["source"],
) {
  if (key === "recommendation") return source.recommendationStatus;
  if (key === "roi") return source.roiStatus;
  if (key === "automation") return source.automationStatus;
  return "";
}
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
