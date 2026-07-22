import type { OrganizationRole } from "@/generated/prisma/client";
import {
  QuestionnaireForbiddenError,
  QuestionnaireImmutableError,
  QuestionnaireNotFoundError,
} from "../domain/questionnaire-errors";
import type { PrismaQuestionnaireRepository } from "../infrastructure/prisma-questionnaire-repository";

export class QuestionnaireService {
  constructor(
    private readonly repository: PrismaQuestionnaireRepository,
    private readonly userId: string,
  ) {}
  private async context() {
    const value = await this.repository.context(this.userId);
    if (!value) throw new QuestionnaireForbiddenError();
    return value;
  }
  private async admin() {
    const value = await this.context();
    if (!(["owner", "admin"] as OrganizationRole[]).includes(value.role))
      throw new QuestionnaireForbiddenError();
    return value;
  }
  async list(query: Parameters<PrismaQuestionnaireRepository["list"]>[1]) {
    const context = await this.context();
    const [items, total] = await this.repository.list(context.organizationId, query);
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      permissions: {
        canManage: ["owner", "admin"].includes(context.role),
        canUse: context.role !== "viewer",
      },
    };
  }
  async get(id: string) {
    const context = await this.context();
    const item = await this.repository.get(id);
    if (!item) throw new QuestionnaireNotFoundError();
    return {
      item,
      permissions: {
        canManage: ["owner", "admin"].includes(context.role) && !item.isSystem,
        canUse: context.role !== "viewer",
      },
    };
  }
  async create(input: { name: string; description?: string; category: string }) {
    const context = await this.admin();
    return this.repository.create(context.organizationId, input);
  }
  async update(id: string, input: { name?: string; description?: string; category?: string }) {
    await this.admin();
    const current = await this.repository.get(id);
    if (!current || current.isSystem) throw new QuestionnaireForbiddenError();
    return this.repository.update(id, input);
  }
  async createVersion(templateId: string) {
    await this.requireManagedTemplate(templateId);
    return this.repository.createVersion(templateId);
  }
  async duplicateVersion(id: string) {
    await this.requireManagedVersion(id);
    const value = await this.repository.duplicate(id);
    if (!value) throw new QuestionnaireNotFoundError();
    return value;
  }
  async publishVersion(id: string) {
    const version = await this.requireManagedVersion(id);
    if (version.status !== "draft") throw new QuestionnaireImmutableError();
    return this.repository.publish(id);
  }
  async archiveVersion(id: string) {
    const version = await this.requireManagedVersion(id);
    if (version.status !== "published") throw new QuestionnaireImmutableError();
    return this.repository.archive(id);
  }
  async addSection(
    versionId: string,
    input: { title: string; description?: string; position: number },
  ) {
    const version = await this.requireManagedVersion(versionId);
    if (version.status !== "draft") throw new QuestionnaireImmutableError();
    return this.repository.createSection(versionId, input);
  }
  async updateSection(
    id: string,
    input: { title?: string; description?: string; position?: number },
  ) {
    await this.requireManagedSection(id);
    return this.repository.updateSection(id, input);
  }
  async moveSection(id: string, position: number) {
    await this.requireManagedSection(id);
    const moved = await this.repository.moveSection(id, position);
    if (!moved) throw new QuestionnaireNotFoundError();
    return moved;
  }
  async deleteSection(id: string) {
    await this.requireManagedSection(id);
    return this.repository.deleteSection(id);
  }
  async addQuestion(
    sectionId: string,
    input: Parameters<PrismaQuestionnaireRepository["createQuestion"]>[1],
  ) {
    await this.requireManagedSection(sectionId);
    return this.repository.createQuestion(sectionId, input);
  }
  async updateQuestion(
    id: string,
    input: Parameters<PrismaQuestionnaireRepository["createQuestion"]>[1],
  ) {
    await this.requireManagedQuestion(id);
    return this.repository.updateQuestion(id, input);
  }
  async deleteQuestion(id: string) {
    await this.requireManagedQuestion(id);
    return this.repository.deleteQuestion(id);
  }
  async moveQuestion(id: string, position: number) {
    await this.requireManagedQuestion(id);
    const moved = await this.repository.moveQuestion(id, position);
    if (!moved) throw new QuestionnaireNotFoundError();
    return moved;
  }
  private async requireManagedTemplate(id: string) {
    await this.admin();
    const template = await this.repository.get(id);
    if (!template) throw new QuestionnaireNotFoundError();
    if (template.isSystem) throw new QuestionnaireForbiddenError();
    return template;
  }
  private async requireManagedVersion(id: string) {
    await this.admin();
    const version = await this.repository.getVersion(id);
    if (!version) throw new QuestionnaireNotFoundError();
    if (version.template.isSystem) throw new QuestionnaireForbiddenError();
    return version;
  }
  private async requireManagedSection(id: string) {
    await this.admin();
    const section = await this.repository.getSection(id);
    if (!section) throw new QuestionnaireNotFoundError();
    if (section.version.status !== "draft") throw new QuestionnaireImmutableError();
    if (section.version.template.isSystem) throw new QuestionnaireForbiddenError();
    return section;
  }
  private async requireManagedQuestion(id: string) {
    await this.admin();
    const question = await this.repository.getQuestion(id);
    if (!question) throw new QuestionnaireNotFoundError();
    if (question.section.version.status !== "draft") throw new QuestionnaireImmutableError();
    if (question.section.version.template.isSystem) throw new QuestionnaireForbiddenError();
    return question;
  }
}
