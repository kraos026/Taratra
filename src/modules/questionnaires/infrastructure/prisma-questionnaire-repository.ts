import type { Prisma } from "@/generated/prisma/client";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";

export class PrismaQuestionnaireRepository {
  constructor(private readonly db: TransactionClient) {}
  context(userId: string) {
    return this.db.organizationMember.findFirst({
      where: { userId },
      select: { organizationId: true, role: true },
    });
  }
  list(
    organizationId: string,
    query: {
      page: number;
      pageSize: number;
      search?: string;
      category?: string;
      status?: "draft" | "published" | "archived";
      isSystem?: boolean;
      sortBy: "name" | "category" | "createdAt" | "updatedAt";
      sortOrder: "asc" | "desc";
    },
  ) {
    const where: Prisma.QuestionnaireTemplateWhereInput = {
      deletedAt: null,
      OR: [{ isSystem: true }, { organizationId }],
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.isSystem === undefined ? {} : { isSystem: query.isSystem }),
      ...(query.status ? { versions: { some: { status: query.status } } } : {}),
    };
    return Promise.all([
      this.db.questionnaireTemplate.findMany({
        where,
        include: { versions: { orderBy: { versionNumber: "desc" } } },
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.questionnaireTemplate.count({ where }),
    ]);
  }
  get(id: string) {
    return this.db.questionnaireTemplate.findFirst({
      where: { id, deletedAt: null },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          include: {
            sections: {
              orderBy: { position: "asc" },
              include: { questions: { orderBy: { position: "asc" } } },
            },
          },
        },
      },
    });
  }
  create(organizationId: string, input: { name: string; description?: string; category: string }) {
    return this.db.questionnaireTemplate.create({
      data: { ...input, organizationId, isSystem: false },
    });
  }
  update(id: string, input: { name?: string; description?: string; category?: string }) {
    return this.db.questionnaireTemplate.update({ where: { id }, data: input });
  }
  async createVersion(templateId: string) {
    const aggregate = await this.db.questionnaireVersion.aggregate({
      where: { questionnaireTemplateId: templateId },
      _max: { versionNumber: true },
    });
    return this.db.questionnaireVersion.create({
      data: {
        questionnaireTemplateId: templateId,
        versionNumber: (aggregate._max.versionNumber ?? 0) + 1,
      },
    });
  }
  async duplicate(id: string) {
    const source = await this.db.questionnaireVersion.findUnique({
      where: { id },
      include: {
        sections: {
          orderBy: { position: "asc" },
          include: { questions: { orderBy: { position: "asc" } } },
        },
      },
    });
    if (!source) return null;
    const created = await this.createVersion(source.questionnaireTemplateId);
    for (const section of source.sections) {
      const copy = await this.db.questionnaireSection.create({
        data: {
          questionnaireVersionId: created.id,
          title: section.title,
          description: section.description,
          position: section.position,
        },
      });
      if (section.questions.length)
        await this.db.questionnaireQuestion.createMany({
          data: section.questions.map((question) => ({
            questionnaireSectionId: copy.id,
            code: question.code,
            label: question.label,
            description: question.description,
            questionType: question.questionType,
            required: question.required,
            position: question.position,
            optionsJson: (question.optionsJson ?? undefined) as Prisma.InputJsonValue | undefined,
            validationJson: question.validationJson as Prisma.InputJsonValue,
            metadataJson: question.metadataJson as Prisma.InputJsonValue,
          })),
        });
    }
    return created;
  }
  async publish(id: string) {
    const target = await this.db.questionnaireVersion.findUnique({ where: { id } });
    if (!target) return null;
    await this.db.questionnaireVersion.updateMany({
      where: { questionnaireTemplateId: target.questionnaireTemplateId, status: "published" },
      data: { status: "archived" },
    });
    return this.db.questionnaireVersion.update({
      where: { id },
      data: { status: "published", publishedAt: new Date() },
    });
  }
  archive(id: string) {
    return this.db.questionnaireVersion.update({ where: { id }, data: { status: "archived" } });
  }
  getVersion(id: string) {
    return this.db.questionnaireVersion.findUnique({
      where: { id },
      include: {
        template: true,
        sections: {
          orderBy: { position: "asc" },
          include: { questions: { orderBy: { position: "asc" } } },
        },
      },
    });
  }
  createSection(
    versionId: string,
    input: { title: string; description?: string; position: number },
  ) {
    return this.db.questionnaireSection.create({
      data: { ...input, questionnaireVersionId: versionId },
    });
  }
  updateSection(id: string, input: { title?: string; description?: string; position?: number }) {
    return this.db.questionnaireSection.update({ where: { id }, data: input });
  }
  deleteSection(id: string) {
    return this.db.questionnaireSection.delete({ where: { id } });
  }
  createQuestion(
    sectionId: string,
    input: {
      code: string;
      label: string;
      description?: string;
      questionType:
        | "short_text"
        | "long_text"
        | "number"
        | "boolean"
        | "single_choice"
        | "multiple_choice"
        | "percentage"
        | "currency"
        | "date";
      required: boolean;
      position: number;
      optionsJson?: unknown[];
      validationJson: Record<string, unknown>;
      metadataJson: Record<string, unknown>;
    },
  ) {
    return this.db.questionnaireQuestion.create({
      data: {
        ...input,
        questionnaireSectionId: sectionId,
        optionsJson: input.optionsJson as Prisma.InputJsonValue | undefined,
        validationJson: input.validationJson as Prisma.InputJsonValue,
        metadataJson: input.metadataJson as Prisma.InputJsonValue,
      },
    });
  }
  updateQuestion(
    id: string,
    input: Parameters<PrismaQuestionnaireRepository["createQuestion"]>[1],
  ) {
    const { ...data } = input;
    return this.db.questionnaireQuestion.update({
      where: { id },
      data: {
        ...data,
        optionsJson: data.optionsJson as Prisma.InputJsonValue | undefined,
        validationJson: data.validationJson as Prisma.InputJsonValue,
        metadataJson: data.metadataJson as Prisma.InputJsonValue,
      },
    });
  }
  deleteQuestion(id: string) {
    return this.db.questionnaireQuestion.delete({ where: { id } });
  }
}
