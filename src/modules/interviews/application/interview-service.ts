import { InterviewEngine } from "../domain/interview-engine";
import {
  InterviewForbiddenError,
  InterviewNotFoundError,
  InterviewValidationError,
} from "../domain/interview-errors";
import type { PrismaInterviewRepository } from "../infrastructure/prisma-interview-repository";

export class InterviewService {
  constructor(
    private readonly repo: PrismaInterviewRepository,
    private readonly userId: string,
    private readonly engine = new InterviewEngine(),
  ) {}

  private async context() {
    const context = await this.repo.context(this.userId);
    if (!context) throw new InterviewForbiddenError();
    return context;
  }

  private write(role: string) {
    if (role === "viewer") throw new InterviewForbiddenError();
  }

  async start(companyId: string) {
    const context = await this.context();
    this.write(context.role);
    const discovery = await this.repo.validatedDiscovery(context.organizationId, companyId);
    if (!discovery)
      throw new InterviewValidationError("A validated Discovery is required to start an interview");
    const existing = await this.repo.latest(context.organizationId, companyId);
    if (existing && ["draft", "in_progress", "completed"].includes(existing.status))
      return this.view(existing.id);
    const created = await this.repo.create(
      context.organizationId,
      companyId,
      discovery.id,
      this.userId,
      (existing?.version ?? 0) + 1,
    );
    await this.repo.timeline(context.organizationId, created.id, this.userId, "started");
    return this.view(created.id);
  }

  async view(id: string) {
    const context = await this.context();
    const session = await this.repo.session(context.organizationId, id);
    if (!session) throw new InterviewNotFoundError();
    const [questions, answers, facts] = await Promise.all([
      this.repo.questions(context.organizationId),
      this.repo.answers(context.organizationId, id),
      this.repo.discoveryFacts(context.organizationId, session.companyId),
    ]);
    const progress = this.engine.calculateProgress(questions, facts, answers);
    const nextQuestion = this.engine.nextQuestion(questions, facts, answers);
    return {
      session,
      answers,
      progress,
      nextQuestion,
      questions: this.engine.eligibleQuestions(questions, facts, answers),
    };
  }

  async answer(
    id: string,
    lockVersion: number,
    questionId: string,
    value: unknown,
    confidence: "confirmed" | "uncertain",
  ) {
    const context = await this.context();
    this.write(context.role);
    const session = await this.repo.session(context.organizationId, id);
    if (!session) throw new InterviewNotFoundError();
    const questions = await this.repo.questions(context.organizationId);
    const question = questions.find((candidate) => candidate.id === questionId);
    if (!question || !this.engine.validateAnswer(question, value))
      throw new InterviewValidationError("Invalid answer for this interview question");
    await this.repo.assertLock(context.organizationId, id, lockVersion, questionId);
    await this.repo.answer(context.organizationId, id, questionId, this.userId, value, confidence);
    await this.repo.decision(
      context.organizationId,
      id,
      questionId,
      "answered",
      "Validated deterministic answer",
      {},
    );
    return this.refreshProgress(context.organizationId, id, session.companyId);
  }

  async skip(
    id: string,
    lockVersion: number,
    questionId: string,
    reason: "irrelevant" | "unknown" | "deferred",
  ) {
    const context = await this.context();
    this.write(context.role);
    const session = await this.repo.session(context.organizationId, id);
    if (!session) throw new InterviewNotFoundError();
    await this.repo.assertLock(context.organizationId, id, lockVersion, questionId);
    await this.repo.skip(context.organizationId, id, questionId, this.userId, reason);
    await this.repo.decision(
      context.organizationId,
      id,
      questionId,
      reason === "irrelevant" ? "skip_irrelevant" : "answered",
      `Question skipped: ${reason}`,
      {},
    );
    return this.refreshProgress(context.organizationId, id, session.companyId);
  }

  async goBack(id: string, lockVersion: number, questionId: string) {
    const context = await this.context();
    this.write(context.role);
    const session = await this.repo.session(context.organizationId, id);
    if (!session) throw new InterviewNotFoundError();
    await this.repo.assertLock(context.organizationId, id, lockVersion, questionId);
    await this.repo.removeAnswer(context.organizationId, id, questionId);
    await this.repo.decision(
      context.organizationId,
      id,
      questionId,
      "superseded",
      "Answer reopened by goBack",
      {},
    );
    return this.refreshProgress(context.organizationId, id, session.companyId);
  }

  async complete(id: string) {
    const context = await this.context();
    this.write(context.role);
    const view = await this.view(id);
    if (!view.progress.readyForProcessMapping)
      throw new InterviewValidationError("Interview is not ready for Process Mapping");
    await this.repo.complete(context.organizationId, id);
    await this.repo.timeline(context.organizationId, id, this.userId, "completed");
    return this.view(id);
  }

  async validate(id: string) {
    const context = await this.context();
    if (!["owner", "admin"].includes(context.role)) throw new InterviewForbiddenError();
    const session = await this.repo.session(context.organizationId, id);
    if (!session) throw new InterviewNotFoundError();
    if (session.status !== "completed")
      throw new InterviewValidationError("Only a completed interview can be validated");
    await this.repo.validate(context.organizationId, id, this.userId);
    await this.repo.timeline(context.organizationId, id, this.userId, "validated");
    return this.view(id);
  }

  private async refreshProgress(organizationId: string, id: string, companyId: string) {
    const [questions, initialAnswers, facts] = await Promise.all([
      this.repo.questions(organizationId),
      this.repo.answers(organizationId, id),
      this.repo.discoveryFacts(organizationId, companyId),
    ]);
    const eligible = this.engine.eligibleQuestions(questions, facts, initialAnswers);
    await this.repo.removeIneligibleAnswers(
      organizationId,
      id,
      eligible.map((question) => question.id),
    );
    const answers = await this.repo.answers(organizationId, id);
    const progress = this.engine.calculateProgress(questions, facts, answers);
    await this.repo.storeProgress(organizationId, id, progress);
    return this.view(id);
  }
}
