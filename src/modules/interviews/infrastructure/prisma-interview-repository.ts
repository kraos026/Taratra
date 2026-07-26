import { Prisma } from "@/generated/prisma/client";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import type {
  InterviewAnswerValue,
  InterviewProgressResult,
  InterviewQuestionDefinition,
} from "../domain/interview-engine";
import { InterviewConflictError } from "../domain/interview-errors";

export class PrismaInterviewRepository {
  constructor(private readonly db: TransactionClient) {}

  context(userId: string) {
    return this.db.organizationMember.findFirst({
      where: { userId },
      select: { organizationId: true, role: true },
    });
  }

  validatedDiscovery(organizationId: string, companyId: string) {
    return this.db.discoverySession.findFirst({
      where: { organizationId, companyId, status: "validated" },
      orderBy: { version: "desc" },
    });
  }

  latest(organizationId: string, companyId: string) {
    return this.db.interviewSession.findFirst({
      where: { organizationId, companyId, status: { not: "archived" } },
      orderBy: { version: "desc" },
    });
  }

  session(organizationId: string, id: string) {
    return this.db.interviewSession.findFirst({ where: { organizationId, id } });
  }

  create(
    organizationId: string,
    companyId: string,
    discoverySessionId: string,
    userId: string,
    version: number,
  ) {
    return this.db.interviewSession.create({
      data: { organizationId, companyId, discoverySessionId, startedBy: userId, version },
    });
  }

  async discoveryFacts(organizationId: string, companyId: string) {
    const [profile, software, processes] = await Promise.all([
      this.db.companyProfile.findFirst({ where: { organizationId, companyId } }),
      this.db.companySoftware.findMany({ where: { organizationId, companyId } }),
      this.db.businessProcess.findMany({ where: { organizationId, companyId } }),
    ]);
    return {
      industry: profile?.industry ?? null,
      countryCode: profile?.countryCode ?? null,
      employeeCount: profile?.employeeCount ?? null,
      businessModel: profile?.businessModel ?? null,
      growthStage: profile?.growthStage ?? null,
      softwareCount: software.length,
      processCount: processes.length,
    };
  }

  async questions(organizationId: string): Promise<InterviewQuestionDefinition[]> {
    const rows = await this.db.interviewQuestion.findMany({
      where: { active: true, OR: [{ organizationId: null }, { organizationId }] },
      orderBy: [{ sequence: "asc" }, { code: "asc" }, { version: "desc" }],
    });
    const latest = new Map<string, (typeof rows)[number]>();
    for (const row of rows) if (!latest.has(row.code)) latest.set(row.code, row);
    return [...latest.values()].map((row) => ({
      id: row.id,
      code: row.code,
      domain: row.domain,
      prompt: row.prompt,
      answerType: row.answerType,
      options: row.optionsJson,
      mandatory: row.mandatory,
      weight: Number(row.weight),
      sequence: row.sequence,
      condition: row.conditionJson as InterviewQuestionDefinition["condition"],
      validation: row.validationJson as Record<string, unknown>,
    }));
  }

  async answers(organizationId: string, sessionId: string): Promise<InterviewAnswerValue[]> {
    const rows = await this.db.interviewAnswer.findMany({
      where: { organizationId, interviewSessionId: sessionId },
    });
    const questions = await this.db.interviewQuestion.findMany({
      where: { id: { in: rows.map((row) => row.questionId) } },
      select: { id: true, code: true },
    });
    const codes = new Map(questions.map((question) => [question.id, question.code]));
    return rows.map((row) => ({
      questionId: row.questionId,
      code: codes.get(row.questionId) ?? "",
      value: row.valueJson,
      confidence: row.confidence,
      skipReason: row.skipReason,
    }));
  }

  async assertLock(
    organizationId: string,
    id: string,
    lockVersion: number,
    currentQuestionId?: string,
  ) {
    const changed = await this.db.interviewSession.updateMany({
      where: {
        organizationId,
        id,
        lockVersion,
        status: { in: ["draft", "in_progress"] },
      },
      data: {
        lockVersion: { increment: 1 },
        status: "in_progress",
        currentQuestionId,
      },
    });
    if (changed.count !== 1) throw new InterviewConflictError();
  }

  answer(
    organizationId: string,
    sessionId: string,
    questionId: string,
    userId: string,
    value: unknown,
    confidence: "confirmed" | "uncertain",
  ) {
    return this.db.interviewAnswer.upsert({
      where: { interviewSessionId_questionId: { interviewSessionId: sessionId, questionId } },
      create: {
        organizationId,
        interviewSessionId: sessionId,
        questionId,
        answeredBy: userId,
        valueJson: value as Prisma.InputJsonValue,
        confidence,
      },
      update: {
        valueJson: value as Prisma.InputJsonValue,
        skipReason: null,
        confidence,
        answeredBy: userId,
        revision: { increment: 1 },
      },
    });
  }

  skip(
    organizationId: string,
    sessionId: string,
    questionId: string,
    userId: string,
    reason: "irrelevant" | "unknown" | "deferred",
  ) {
    return this.db.interviewAnswer.upsert({
      where: { interviewSessionId_questionId: { interviewSessionId: sessionId, questionId } },
      create: {
        organizationId,
        interviewSessionId: sessionId,
        questionId,
        answeredBy: userId,
        valueJson: Prisma.DbNull,
        skipReason: reason,
        confidence: "missing",
      },
      update: {
        valueJson: Prisma.DbNull,
        skipReason: reason,
        confidence: "missing",
        answeredBy: userId,
        revision: { increment: 1 },
      },
    });
  }

  async removeAnswer(organizationId: string, sessionId: string, questionId: string) {
    await this.db.interviewAnswer.deleteMany({
      where: { organizationId, interviewSessionId: sessionId, questionId },
    });
  }

  async removeIneligibleAnswers(
    organizationId: string,
    sessionId: string,
    eligibleQuestionIds: string[],
  ) {
    return this.db.interviewAnswer.deleteMany({
      where: {
        organizationId,
        interviewSessionId: sessionId,
        questionId: { notIn: eligibleQuestionIds },
      },
    });
  }

  decision(
    organizationId: string,
    sessionId: string,
    questionId: string,
    decision: string,
    reason: string,
    facts: Record<string, unknown>,
  ) {
    return this.db.interviewDecision.create({
      data: {
        organizationId,
        interviewSessionId: sessionId,
        questionId,
        decision,
        reason,
        factsJson: facts as Prisma.InputJsonValue,
      },
    });
  }

  async storeProgress(
    organizationId: string,
    sessionId: string,
    progress: InterviewProgressResult,
  ) {
    await this.db.interviewProgress.deleteMany({
      where: { organizationId, interviewSessionId: sessionId },
    });
    if (progress.domains.length)
      await this.db.interviewProgress.createMany({
        data: progress.domains.map((domain) => ({
          organizationId,
          interviewSessionId: sessionId,
          ...domain,
        })),
      });
  }

  timeline(
    organizationId: string,
    sessionId: string,
    actorId: string,
    eventType: string,
    metadata: Record<string, unknown> = {},
  ) {
    return this.db.interviewTimeline.create({
      data: {
        organizationId,
        interviewSessionId: sessionId,
        actorId,
        eventType,
        metadataJson: metadata as Prisma.InputJsonValue,
      },
    });
  }

  complete(organizationId: string, id: string) {
    return this.db.interviewSession.update({
      where: { id, organizationId },
      data: { status: "completed", completedAt: new Date(), lockVersion: { increment: 1 } },
    });
  }

  validate(organizationId: string, id: string, userId: string) {
    return this.db.interviewSession.update({
      where: { id, organizationId },
      data: {
        status: "validated",
        validatedAt: new Date(),
        validatedBy: userId,
        lockVersion: { increment: 1 },
      },
    });
  }
}
