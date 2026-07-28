export type SpecificationStatus = "draft" | "validated" | "published" | "archived";
export type SpecificationSeverity = "error" | "warning" | "information";
export type SpecificationElementType =
  | "trigger"
  | "data_contract"
  | "step"
  | "dependency"
  | "control"
  | "error_policy"
  | "security"
  | "observability"
  | "acceptance_criterion";

export interface BlueprintComponent {
  code: string;
  name: string;
}

export interface BlueprintEdge {
  from: string;
  to: string;
  type: string;
  label: string;
}

export interface PublishedBlueprint {
  id: string;
  organizationId: string;
  versionNumber: number;
  status: SpecificationStatus;
  name: string;
  objective: string;
  components: BlueprintComponent[];
  capabilities: { code: string; name: string }[];
  connectors: {
    code: string;
    name: string;
    inputs: string[];
    outputs: string[];
    secrets: string[];
    permissions: string[];
  }[];
  constraints: { code: string; name: string }[];
  inputs: string[];
  outputs: string[];
  topology: BlueprintEdge[];
}

export type TransformationDecision =
  | "project_triggers"
  | "project_data_contracts"
  | "project_steps"
  | "project_dependencies"
  | "project_controls"
  | "project_error_policies"
  | "project_security"
  | "project_observability"
  | "project_acceptance_criteria";

export type SpecificationValidationOperator =
  | "source_published"
  | "elements_present"
  | "unique_local_ids"
  | "references_valid"
  | "graph_acyclic"
  | "data_contracts_resolved"
  | "provenance_complete";

export interface SpecificationRule {
  id: string;
  code: string;
  version: number;
  ruleType: "transformation" | "validation";
  decision?: TransformationDecision;
  operator?: SpecificationValidationOperator;
  severity?: SpecificationSeverity;
  description: string;
  published: boolean;
}

export interface SpecificationElement {
  localId: string;
  type: SpecificationElementType;
  definition: Record<string, unknown>;
  displayOrder: number;
}

export interface SpecificationProvenance {
  targetLocalId: string | null;
  sourceElementType: string;
  sourceElementId: string;
  ruleCode: string | null;
  ruleVersion: number | null;
  reason: string;
  consumed: boolean;
}

export interface SpecificationValidation {
  ruleCode: string;
  ruleVersion: number;
  severity: SpecificationSeverity;
  passed: boolean;
  targetLocalId: string | null;
  message: string;
  details: Record<string, unknown>;
}

export interface AutomationSpecificationResult {
  name: string;
  objective: string;
  scope: string;
  elements: SpecificationElement[];
  provenance: SpecificationProvenance[];
  validations: SpecificationValidation[];
  catalogVersions: { id: string; code: string; version: number }[];
}

export interface AutomationSpecificationInput {
  blueprint: PublishedBlueprint;
  rules: SpecificationRule[];
}
