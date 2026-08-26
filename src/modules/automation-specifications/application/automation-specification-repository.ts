import type {
  AutomationSpecificationInput,
  AutomationSpecificationResult,
  SpecificationElementType,
  SpecificationStatus,
  SpecificationSeverity,
  SpecificationValidation,
} from "../domain/automation-specification";

export interface AutomationSpecificationSnapshot {
  id: string;
  organizationId: string;
  solutionBlueprintId: string;
  status: SpecificationStatus;
  lockVersion: number;
  versionNumber: number;
  isLatestVersion: boolean;
}

export interface AutomationSpecificationDetail {
  specification: AutomationSpecificationSnapshot;
  validations: SpecificationValidation[];
}

export interface PreparedAutomationSpecificationPersistencePlan {
  readonly specificationHeader: {
    readonly id: string;
    readonly organizationId: string;
    readonly solutionBlueprintId: string;
    readonly solutionBlueprintVersionNumber: number;
    readonly name: string;
    readonly objective: string;
    readonly scope: string;
    readonly sourceFingerprint: string;
    readonly catalogVersionsJson: unknown;
    readonly createdBy: string;
  };
  readonly elementRows: readonly {
    readonly id: string;
    readonly organizationId: string;
    readonly automationSpecificationId: string;
    readonly localId: string;
    readonly elementType: SpecificationElementType;
    readonly definitionJson: unknown;
    readonly displayOrder: number;
  }[];
  readonly provenanceRows: readonly {
    readonly id: string;
    readonly organizationId: string;
    readonly automationSpecificationId: string;
    readonly targetLocalId: string | null;
    readonly sourceElementType: string;
    readonly sourceElementId: string;
    readonly catalogRuleCode: string | null;
    readonly catalogRuleVersion: number | null;
    readonly reason: string;
    readonly consumed: boolean;
  }[];
  readonly validationRows: readonly {
    readonly id: string;
    readonly organizationId: string;
    readonly automationSpecificationId: string;
    readonly ruleCode: string;
    readonly ruleVersion: number;
    readonly severity: SpecificationSeverity;
    readonly passed: boolean;
    readonly targetLocalId: string | null;
    readonly message: string;
    readonly detailsJson: unknown;
  }[];
}

export interface AutomationSpecificationRepository {
  context(userId: string): Promise<{ organizationId: string; role: string } | null>;
  input(
    organizationId: string,
    solutionBlueprintId: string,
  ): Promise<AutomationSpecificationInput | null>;
  persist(
    organizationId: string,
    userId: string,
    input: AutomationSpecificationInput,
    result: AutomationSpecificationResult,
    previousVersionId: string | null,
  ): Promise<unknown>;
  persistPrepared(
    organizationId: string,
    plan: PreparedAutomationSpecificationPersistencePlan,
    previousVersionId: string | null,
  ): Promise<AutomationSpecificationSnapshot>;
  prepareRebuild(
    organizationId: string,
    id: string,
    lockVersion: number,
  ): Promise<AutomationSpecificationSnapshot | null>;
  detail(organizationId: string, id: string): Promise<AutomationSpecificationDetail | null>;
  list(
    organizationId: string,
    solutionBlueprintId: string,
    query: {
      page: number;
      pageSize: number;
      status?: SpecificationStatus;
      latestPublished?: boolean;
    },
  ): Promise<unknown>;
  transition(
    organizationId: string,
    id: string,
    lockVersion: number,
    status: "validated" | "published" | "archived",
  ): Promise<unknown>;
}
