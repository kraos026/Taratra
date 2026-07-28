import type {
  SpecificationStatus,
  SpecificationValidation,
} from "../domain/automation-specification";

export interface AutomationSpecificationDto {
  id: string;
  solutionBlueprintId: string;
  versionNumber: number;
  status: SpecificationStatus;
  lockVersion: number;
  isLatestVersion: boolean;
  validations: SpecificationValidation[];
}
