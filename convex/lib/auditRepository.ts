import { ConvexError } from "convex/values";
import type {
  AuditRepository,
  AuditListQuery,
  AuditVersion,
  AuditDetail,
  AuditSummary,
} from "../../src/modules/audits/application/audit-repository";
import {
  AuditForbiddenError,
  AuditNotFoundError,
  AuditStateError,
} from "../../src/modules/audits/domain/audit-errors";
import { calculateProgress, evaluateCompletion } from "../../src/modules/audits/domain/progress";
import type { Doc } from "../_generated/dataModel";
import type { DatabaseCtx, TrustedContext } from "./access";
import { businessId } from "./businessId";
import { mapCompany } from "./companyRepository";
import { modelRecord } from "./modelRecord";

function bounded<T>(items: T[], maximum: number) {
  if (items.length > maximum) throw new ConvexError({ code: "PILOT_CAPACITY_LIMIT", status: 409 });
  return items;
}
export class ConvexAuditRepository implements AuditRepository {
  constructor(
    private readonly ctx: DatabaseCtx,
    private readonly scope: TrustedContext,
  ) {}
  private organization(id: string) {
    if (id !== this.scope.organizationId) throw new AuditForbiddenError();
  }
  private writer() {
    if (!("insert" in this.ctx.db)) throw new Error("MUTATION_REQUIRED");
    return this.ctx.db;
  }
  async context(userId: string) {
    return userId === this.scope.userId
      ? { organizationId: this.scope.organizationId, role: this.scope.role }
      : null;
  }
  async document(organizationId: string, id: string) {
    this.organization(organizationId);
    const doc = await this.ctx.db
      .query("audits")
      .withIndex("by_id_organizationId", (q) => q.eq("id", id).eq("organizationId", organizationId))
      .unique();
    return doc?.deletedAt === null ? doc : null;
  }
  private async company(id: string) {
    return this.ctx.db
      .query("companies")
      .withIndex("by_organizationId_id", (q) =>
        q.eq("organizationId", this.scope.organizationId).eq("id", id),
      )
      .unique();
  }
  async accessibleVersion(id: string): Promise<AuditVersion | null> {
    const version = await this.ctx.db
      .query("questionnaire_versions")
      .withIndex("by_business_id", (q) => q.eq("id", id))
      .unique();
    if (!version) return null;
    const template = await this.ctx.db
      .query("questionnaire_templates")
      .withIndex("by_business_id", (q) => q.eq("id", version.questionnaireTemplateId))
      .unique();
    if (
      !template ||
      template.deletedAt !== null ||
      !(template.isSystem || template.organizationId === this.scope.organizationId)
    )
      return null;
    return { ...modelRecord(version), template: modelRecord(template) };
  }
  async versionSections(id: string) {
    const sections = bounded(
      await this.ctx.db
        .query("questionnaire_sections")
        .withIndex("by_questionnaireVersionId_position", (q) => q.eq("questionnaireVersionId", id))
        .take(101),
      100,
    );
    return Promise.all(
      sections.map(async (section) => {
        const questions = bounded(
          await this.ctx.db
            .query("questionnaire_questions")
            .withIndex("by_questionnaireSectionId_position", (q) =>
              q.eq("questionnaireSectionId", section.id),
            )
            .take(201),
          200,
        );
        return {
          ...modelRecord(section),
          questions: questions.map((question) => modelRecord(question)),
        };
      }),
    );
  }
  private async summary(doc: Doc<"audits">): Promise<AuditSummary> {
    const company = await this.company(doc.companyId);
    if (!company) throw new AuditNotFoundError();
    const version = doc.questionnaireVersionId
      ? await this.accessibleVersion(doc.questionnaireVersionId)
      : null;
    if (doc.questionnaireVersionId && !version) throw new AuditNotFoundError();
    return { ...modelRecord(doc), company: mapCompany(company), questionnaireVersion: version };
  }
  async list(organizationId: string, query: AuditListQuery): Promise<[AuditSummary[], number]> {
    this.organization(organizationId);
    const rows = bounded(
      await this.ctx.db
        .query("audits")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
        .take(1001),
      1000,
    ).filter(
      (row) =>
        row.deletedAt === null &&
        (!query.companyId || row.companyId === query.companyId) &&
        (!query.status || row.status === query.status),
    );
    const statuses = ["draft", "in_progress", "completed", "validated", "archived"];
    rows.sort((a, b) => {
      const order =
        query.sortBy === "progressPercentage"
          ? a.progressPercentage - b.progressPercentage
          : query.sortBy === "status"
            ? statuses.indexOf(a.status) - statuses.indexOf(b.status)
            : Date.parse(a[query.sortBy]) - Date.parse(b[query.sortBy]);
      return (query.sortOrder === "asc" ? order : -order) || a.id.localeCompare(b.id);
    });
    return [
      await Promise.all(
        rows
          .slice((query.page - 1) * query.pageSize, query.page * query.pageSize)
          .map((row) => this.summary(row)),
      ),
      rows.length,
    ];
  }
  async get(organizationId: string, id: string): Promise<AuditDetail | null> {
    const doc = await this.document(organizationId, id);
    if (!doc) return null;
    const summary = await this.summary(doc);
    const answers = bounded(
      await this.ctx.db
        .query("audit_answers")
        .withIndex("by_auditId", (q) => q.eq("auditId", id))
        .take(1001),
      1000,
    );
    if (answers.some((answer) => answer.organizationId !== organizationId))
      throw new AuditForbiddenError();
    return {
      ...summary,
      answers: answers.map((answer) => modelRecord(answer)),
      questionnaireVersion: summary.questionnaireVersion
        ? {
            ...summary.questionnaireVersion,
            sections: await this.versionSections(summary.questionnaireVersion.id),
          }
        : null,
    };
  }
  private async writable(organizationId: string, id: string) {
    const doc = await this.document(organizationId, id);
    if (!doc) throw new AuditNotFoundError();
    if (["validated", "archived"].includes(doc.status))
      throw new AuditStateError("Validated and archived audits are read-only");
    const company = await this.company(doc.companyId);
    const version = doc.questionnaireVersionId
      ? await this.accessibleVersion(doc.questionnaireVersionId)
      : null;
    if (!company || company.deletedAt !== null || !version || version.status !== "published")
      throw new AuditStateError("Audit company and published questionnaire must remain accessible");
    return doc;
  }
  async create(
    organizationId: string,
    input: { companyId: string; questionnaireVersionId: string },
  ) {
    this.organization(organizationId);
    const company = await this.company(input.companyId),
      version = await this.accessibleVersion(input.questionnaireVersionId);
    if (!company || company.deletedAt !== null || !version || version.status !== "published")
      throw new AuditNotFoundError();
    const id = businessId(),
      now = new Date().toISOString();
    if (
      await this.ctx.db
        .query("audits")
        .withIndex("by_business_id", (q) => q.eq("id", id))
        .first()
    )
      throw new Error("IDENTIFIER_COLLISION");
    const nativeId = await this.writer().insert("audits", {
      legacyKey: JSON.stringify([id]),
      id,
      organizationId,
      ...input,
      status: "draft",
      ruleSetVersion: null,
      startedAt: null,
      completedAt: null,
      progressPercentage: 0,
      currentSectionId: null,
      validatedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    return modelRecord((await this.ctx.db.get(nativeId))!);
  }
  async update(organizationId: string, id: string, input: { currentSectionId?: string | null }) {
    const doc = await this.writable(organizationId, id);
    if (
      input.currentSectionId &&
      !(await this.sectionBelongsToAudit(organizationId, id, input.currentSectionId))
    )
      throw new AuditStateError("Invalid questionnaire section");
    await this.writer().patch(doc._id, { ...input, updatedAt: new Date().toISOString() });
    return modelRecord((await this.ctx.db.get(doc._id))!);
  }
  async sectionBelongsToAudit(organizationId: string, auditId: string, sectionId: string) {
    const audit = await this.document(organizationId, auditId);
    if (!audit) return null;
    const section = await this.ctx.db
      .query("questionnaire_sections")
      .withIndex("by_business_id", (q) => q.eq("id", sectionId))
      .unique();
    return section?.questionnaireVersionId === audit.questionnaireVersionId
      ? { id: section.id }
      : null;
  }
  async findQuestion(auditId: string, questionId: string) {
    const audit = await this.document(this.scope.organizationId, auditId);
    if (!audit) return null;
    const question = await this.ctx.db
      .query("questionnaire_questions")
      .withIndex("by_business_id", (q) => q.eq("id", questionId))
      .unique();
    if (
      !question ||
      !(await this.sectionBelongsToAudit(
        this.scope.organizationId,
        auditId,
        question.questionnaireSectionId,
      ))
    )
      return null;
    return modelRecord(question);
  }
  async upsertAnswer(
    organizationId: string,
    auditId: string,
    questionId: string,
    userId: string,
    value: unknown,
  ) {
    await this.writable(organizationId, auditId);
    if (userId !== this.scope.userId) throw new AuditForbiddenError();
    if (!(await this.findQuestion(auditId, questionId))) throw new AuditNotFoundError();
    const existing = await this.ctx.db
      .query("audit_answers")
      .withIndex("by_auditId_questionId", (q) =>
        q.eq("auditId", auditId).eq("questionId", questionId),
      )
      .unique();
    const now = new Date().toISOString();
    if (existing) {
      if (existing.organizationId !== organizationId) throw new AuditForbiddenError();
      await this.writer().patch(existing._id, {
        valueJson: value,
        answeredBy: userId,
        updatedAt: now,
      });
      return modelRecord((await this.ctx.db.get(existing._id))!);
    }
    const id = businessId();
    const nativeId = await this.writer().insert("audit_answers", {
      legacyKey: JSON.stringify([id]),
      id,
      organizationId,
      auditId,
      questionId,
      valueJson: value,
      answeredBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    return modelRecord((await this.ctx.db.get(nativeId))!);
  }
  async recalculate(organizationId: string, id: string) {
    const doc = await this.writable(organizationId, id),
      audit = await this.get(organizationId, id);
    if (!audit) return null;
    const questions =
      audit.questionnaireVersion?.sections.flatMap((section) => section.questions) ?? [];
    const answered = new Set(audit.answers.map((answer) => answer.questionId));
    const now = new Date().toISOString();
    await this.writer().patch(doc._id, {
      progressPercentage: calculateProgress(questions.length, answered.size),
      status: doc.status === "draft" ? "in_progress" : doc.status,
      startedAt: doc.startedAt ?? now,
      updatedAt: now,
    });
    return modelRecord((await this.ctx.db.get(doc._id))!);
  }
  async complete(organizationId: string, id: string) {
    const audit = await this.get(organizationId, id);
    if (!audit) return null;
    const doc = await this.writable(organizationId, id);
    const questions =
      audit.questionnaireVersion?.sections.flatMap((section) => section.questions) ?? [];
    if (!questions.length) throw new AuditStateError("Audit requires a non-empty questionnaire");
    const completion = evaluateCompletion(
      questions.map((question) => question.id),
      questions.filter((question) => question.required).map((question) => question.id),
      new Set(audit.answers.map((answer) => answer.questionId)),
    );
    if (!completion.canComplete) return false;
    const now = new Date().toISOString();
    await this.writer().patch(doc._id, {
      status: "completed",
      completedAt: doc.completedAt ?? now,
      progressPercentage: completion.progress,
      updatedAt: now,
    });
    return modelRecord((await this.ctx.db.get(doc._id))!);
  }
  async validate(organizationId: string, id: string) {
    const doc = await this.writable(organizationId, id);
    if (!["owner", "admin"].includes(this.scope.role)) throw new AuditForbiddenError();
    if (doc.status !== "completed")
      throw new AuditStateError("Only completed audits can be validated");
    const now = new Date().toISOString();
    await this.writer().patch(doc._id, { status: "validated", validatedAt: now, updatedAt: now });
    return modelRecord((await this.ctx.db.get(doc._id))!);
  }
  async archive(organizationId: string, id: string) {
    const doc = await this.document(organizationId, id);
    if (!doc) throw new AuditNotFoundError();
    const now = new Date().toISOString();
    await this.writer().patch(doc._id, { status: "archived", deletedAt: now, updatedAt: now });
    return modelRecord((await this.ctx.db.get(doc._id))!);
  }
}
