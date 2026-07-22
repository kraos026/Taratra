import { validateAnswer } from "../../questionnaires/domain/answer-validator";
import {
  AuditForbiddenError,
  AuditIncompleteError,
  AuditNotFoundError,
  AuditStateError,
} from "../domain/audit-errors";
import type { PrismaAuditRepository } from "../infrastructure/prisma-audit-repository";
export class AuditService {
  constructor(
    private readonly repository: PrismaAuditRepository,
    private readonly userId: string,
  ) {}
  private async context() {
    const c = await this.repository.context(this.userId);
    if (!c) throw new AuditForbiddenError();
    return c;
  }
  private async editor() {
    const c = await this.context();
    if (c.role === "viewer") throw new AuditForbiddenError();
    return c;
  }
  async list(query: Parameters<PrismaAuditRepository["list"]>[1]) {
    const c = await this.context();
    const [items, total] = await this.repository.list(c.organizationId, query);
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      permissions: {
        canWrite: c.role !== "viewer",
        canValidate: ["owner", "admin"].includes(c.role),
      },
    };
  }
  async get(id: string) {
    const c = await this.context();
    const item = await this.repository.get(c.organizationId, id);
    if (!item) throw new AuditNotFoundError();
    return {
      item,
      permissions: {
        canWrite: c.role !== "viewer" && !["validated", "archived"].includes(item.status),
        canValidate: ["owner", "admin"].includes(c.role) && item.status === "completed",
      },
    };
  }
  async create(input: { companyId: string; questionnaireVersionId: string }) {
    const c = await this.editor();
    return this.repository.create(c.organizationId, input);
  }
  async update(id: string, input: { currentSectionId?: string | null }) {
    const c = await this.editor();
    const current = (await this.get(id)).item;
    if (["validated", "archived"].includes(current.status))
      throw new AuditStateError("Validated and archived audits are read-only");
    return this.repository.update(c.organizationId, id, input);
  }
  async answer(id: string, questionId: string, value: unknown) {
    const c = await this.editor();
    const audit = (await this.get(id)).item;
    if (["validated", "archived"].includes(audit.status))
      throw new AuditStateError("Audit answers are read-only");
    const question = await this.repository.findQuestion(id, questionId);
    if (!question) throw new AuditNotFoundError();
    const validated = validateAnswer(
      {
        questionType: question.questionType,
        optionsJson: question.optionsJson,
        validationJson: question.validationJson,
      },
      value,
    );
    await this.repository.upsertAnswer(c.organizationId, id, questionId, this.userId, validated);
    return this.repository.recalculate(c.organizationId, id);
  }
  async complete(id: string) {
    const c = await this.editor();
    const result = await this.repository.complete(c.organizationId, id);
    if (result === null) throw new AuditNotFoundError();
    if (result === false) throw new AuditIncompleteError();
    return result;
  }
  async validate(id: string) {
    const c = await this.context();
    if (!["owner", "admin"].includes(c.role)) throw new AuditForbiddenError();
    const audit = (await this.get(id)).item;
    if (audit.status !== "completed")
      throw new AuditStateError("Only completed audits can be validated");
    return this.repository.validate(c.organizationId, id);
  }
  async archive(id: string) {
    const c = await this.editor();
    return this.repository.archive(c.organizationId, id);
  }
}
