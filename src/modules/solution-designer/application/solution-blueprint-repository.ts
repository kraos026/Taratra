import type { BlueprintResult, DesignerInput } from "../domain/solution-designer";

export interface BlueprintSnapshot {
  id: string;
  recommendationId: string;
  status: "draft" | "validated" | "published" | "archived";
  lockVersion: number;
}

export interface BlueprintDetail {
  blueprint: BlueprintSnapshot;
  evidence: { id: string }[];
  validations: {
    code: string;
    severity: "error" | "warning" | "information";
    message: string;
    passed: boolean;
  }[];
}

export interface SolutionBlueprintRepository {
  context(userId: string): Promise<{ organizationId: string; role: string } | null>;
  input(organizationId: string, recommendationId: string): Promise<DesignerInput | null>;
  persist(
    organizationId: string,
    userId: string,
    input: DesignerInput,
    result: BlueprintResult,
    previousVersionId: string | null,
  ): Promise<unknown>;
  prepareRebuild(
    organizationId: string,
    id: string,
    lockVersion: number,
  ): Promise<BlueprintSnapshot | null>;
  detail(organizationId: string, id: string): Promise<BlueprintDetail | null>;
  list(
    organizationId: string,
    companyId: string,
    query: { page: number; pageSize: number; status?: string },
  ): Promise<unknown>;
  transition(
    organizationId: string,
    id: string,
    lockVersion: number,
    status: "validated" | "published",
  ): Promise<unknown>;
}
