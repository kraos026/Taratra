import type {
  Audit,
  AuditAnswer,
  Company,
  QuestionnaireTemplate,
  QuestionnaireVersion,
  QuestionnaireSection,
  QuestionnaireQuestion,
} from "../../../generated/prisma/client";
import type { OrganizationContext } from "../../companies/domain/company";

// Compatibility DTOs keep the current service contract. These are type-only imports;
// Convex never loads the Prisma runtime or changes canonical progress calculations.
export type AuditListQuery = {
  page: number;
  pageSize: number;
  companyId?: string;
  status?: "draft" | "in_progress" | "completed" | "validated" | "archived";
  sortBy: "createdAt" | "updatedAt" | "progressPercentage" | "status";
  sortOrder: "asc" | "desc";
};
export type AuditVersion = QuestionnaireVersion & { template: QuestionnaireTemplate };
export type AuditSummary = Audit & { company: Company; questionnaireVersion: AuditVersion | null };
export type AuditDetail = Audit & {
  company: Company;
  answers: AuditAnswer[];
  questionnaireVersion:
    | (AuditVersion & {
        sections: (QuestionnaireSection & { questions: QuestionnaireQuestion[] })[];
      })
    | null;
};
export interface AuditRepository {
  context(userId: string): Promise<OrganizationContext | null>;
  list(organizationId: string, query: AuditListQuery): Promise<[AuditSummary[], number]>;
  get(organizationId: string, id: string): Promise<AuditDetail | null>;
  create(
    organizationId: string,
    input: { companyId: string; questionnaireVersionId: string },
  ): Promise<Audit>;
  update(
    organizationId: string,
    id: string,
    input: { currentSectionId?: string | null },
  ): Promise<Audit>;
  sectionBelongsToAudit(
    organizationId: string,
    auditId: string,
    sectionId: string,
  ): Promise<{ id: string } | null>;
  findQuestion(auditId: string, questionId: string): Promise<QuestionnaireQuestion | null>;
  upsertAnswer(
    organizationId: string,
    auditId: string,
    questionId: string,
    userId: string,
    value: unknown,
  ): Promise<AuditAnswer>;
  recalculate(organizationId: string, id: string): Promise<Audit | null>;
  complete(organizationId: string, id: string): Promise<Audit | null | false>;
  validate(organizationId: string, id: string): Promise<Audit>;
  archive(organizationId: string, id: string): Promise<Audit>;
}
