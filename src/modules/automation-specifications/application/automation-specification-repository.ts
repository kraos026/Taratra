import type {
  AutomationSpecificationInput,
  AutomationSpecificationResult,
  SpecificationStatus,
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
