import { ConvexError } from "convex/values";
import type { InterviewRepository } from "../../src/modules/interviews/application/interview-repository";
import type {
  InterviewAnswerValue,
  InterviewProgressResult,
  InterviewQuestionDefinition,
} from "../../src/modules/interviews/domain/interview-engine";
import {
  InterviewConflictError,
  InterviewForbiddenError,
  InterviewNotFoundError,
  InterviewValidationError,
} from "../../src/modules/interviews/domain/interview-errors";
import { documentSourceSchema } from "../../src/modules/interviews/domain/document-source";
import type { DatabaseCtx, TrustedContext } from "./access";
import { modelRecord } from "./modelRecord";
import { businessId } from "./businessId";
import { discoveryDecimal } from "./discoveryRepository";
function bounded<T>(rows: T[], maximum = 500) {
  if (rows.length > maximum) throw new ConvexError({ code: "PILOT_CAPACITY_LIMIT", status: 409 });
  return rows;
}
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
export class ConvexInterviewRepository implements InterviewRepository {
  constructor(
    private readonly ctx: DatabaseCtx,
    private readonly scope: TrustedContext,
  ) {}
  private writer() {
    if (!("insert" in this.ctx.db)) throw new Error("MUTATION_REQUIRED");
    return this.ctx.db;
  }
  private organization(id: string) {
    if (id !== this.scope.organizationId) throw new InterviewForbiddenError();
  }
  async context(userId: string) {
    return userId === this.scope.userId
      ? { organizationId: this.scope.organizationId, role: this.scope.role }
      : null;
  }
  private async company(organizationId: string, companyId: string) {
    this.organization(organizationId);
    return this.ctx.db
      .query("companies")
      .withIndex("by_organizationId_id", (q) =>
        q.eq("organizationId", organizationId).eq("id", companyId),
      )
      .unique();
  }
  private async document(organizationId: string, id: string) {
    this.organization(organizationId);
    const doc = await this.ctx.db
      .query("interview_sessions")
      .withIndex("by_business_id", (q) => q.eq("id", id))
      .unique();
    return doc?.organizationId === organizationId ? doc : null;
  }
  async validatedDiscovery(organizationId: string, companyId: string) {
    if (!(await this.company(organizationId, companyId))) return null;
    const rows = bounded(
      await this.ctx.db
        .query("discovery_sessions")
        .withIndex("by_organizationId_companyId", (q) =>
          q.eq("organizationId", organizationId).eq("companyId", companyId),
        )
        .take(101),
      100,
    );
    const doc = rows
      .filter((row) => row.status === "validated")
      .sort((a, b) => b.version - a.version)[0];
    return doc ? modelRecord(doc) : null;
  }
  async latest(organizationId: string, companyId: string) {
    this.organization(organizationId);
    const rows = bounded(
      await this.ctx.db
        .query("interview_sessions")
        .withIndex("by_organizationId_companyId", (q) =>
          q.eq("organizationId", organizationId).eq("companyId", companyId),
        )
        .take(101),
      100,
    );
    const doc = rows
      .filter((row) => row.status !== "archived")
      .sort((a, b) => b.version - a.version)[0];
    return doc ? modelRecord(doc) : null;
  }
  async session(organizationId: string, id: string) {
    const doc = await this.document(organizationId, id);
    return doc ? modelRecord(doc) : null;
  }
  async create(
    organizationId: string,
    companyId: string,
    discoverySessionId: string,
    userId: string,
    version: number,
  ) {
    this.organization(organizationId);
    if (userId !== this.scope.userId) throw new InterviewForbiddenError();
    const discovery = await this.validatedDiscovery(organizationId, companyId),
      company = await this.company(organizationId, companyId);
    if (!discovery || discovery.id !== discoverySessionId || !company || company.deletedAt !== null)
      throw new InterviewNotFoundError();
    if (!(await this.questions(organizationId)).length)
      throw new InterviewValidationError("Interview catalogue unavailable");
    const id = businessId(),
      now = new Date().toISOString();
    const native = await this.writer().insert("interview_sessions", {
      legacyKey: JSON.stringify([id]),
      id,
      organizationId,
      companyId,
      discoverySessionId,
      status: "draft",
      version,
      lockVersion: 1,
      currentQuestionId: null,
      startedBy: userId,
      completedAt: null,
      validatedAt: null,
      validatedBy: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    return modelRecord((await this.ctx.db.get(native))!);
  }
  async discoveryFacts(organizationId: string, companyId: string) {
    if (!(await this.company(organizationId, companyId))) throw new InterviewNotFoundError();
    const profile = await this.ctx.db
      .query("company_profiles")
      .withIndex("by_organizationId_companyId", (q) =>
        q.eq("organizationId", organizationId).eq("companyId", companyId),
      )
      .unique();
    const software = bounded(
      await this.ctx.db
        .query("company_software")
        .withIndex("by_organizationId_companyId", (q) =>
          q.eq("organizationId", organizationId).eq("companyId", companyId),
        )
        .take(501),
    );
    const processes = bounded(
      await this.ctx.db
        .query("business_processes")
        .withIndex("by_organizationId_companyId", (q) =>
          q.eq("organizationId", organizationId).eq("companyId", companyId),
        )
        .take(501),
    );
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
    this.organization(organizationId);
    const [system, own] = await Promise.all([
      this.ctx.db
        .query("interview_questions")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", null))
        .take(501),
      this.ctx.db
        .query("interview_questions")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
        .take(501),
    ]);
    const rows = bounded([...system, ...own])
      .filter((row) => row.active)
      .sort(
        (a, b) => a.sequence - b.sequence || a.code.localeCompare(b.code) || b.version - a.version,
      );
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
      condition: row.conditionJson,
      validation: row.validationJson,
    }));
  }
  private async answerRows(organizationId: string, sessionId: string) {
    if (!(await this.document(organizationId, sessionId))) throw new InterviewNotFoundError();
    const rows = bounded(
      await this.ctx.db
        .query("interview_answers")
        .withIndex("by_interviewSessionId_questionId", (q) => q.eq("interviewSessionId", sessionId))
        .take(501),
    );
    if (rows.some((row) => row.organizationId !== organizationId))
      throw new InterviewForbiddenError();
    return rows;
  }
  async answers(organizationId: string, sessionId: string): Promise<InterviewAnswerValue[]> {
    const rows = await this.answerRows(organizationId, sessionId),
      questions = await this.questions(organizationId);
    const codes = new Map(questions.map((question) => [question.id, question.code]));
    if (rows.some((row) => !codes.has(row.questionId)))
      throw new InterviewValidationError("Answer catalogue reference unavailable");
    const decisions = bounded(
      await this.ctx.db
        .query("interview_decisions")
        .withIndex("by_organizationId_interviewSessionId", (q) =>
          q.eq("organizationId", organizationId).eq("interviewSessionId", sessionId),
        )
        .take(2001),
      2000,
    )
      .filter((row) => row.decision === "answered")
      .sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id),
      );
    const sources = new Map<string, ReturnType<typeof documentSourceSchema.safeParse>>();
    for (const decision of decisions)
      if (!sources.has(decision.questionId))
        sources.set(
          decision.questionId,
          documentSourceSchema.safeParse(decision.factsJson?.documentSource),
        );
    return rows.map((row) => ({
      questionId: row.questionId,
      code: codes.get(row.questionId)!,
      value: row.valueJson,
      confidence: row.confidence,
      skipReason: row.skipReason,
      ...(row.valueJson !== null && sources.get(row.questionId)?.success
        ? { documentSource: sources.get(row.questionId)!.data }
        : {}),
    }));
  }
  private async writable(organizationId: string, id: string) {
    const doc = await this.document(organizationId, id);
    if (!doc) throw new InterviewNotFoundError();
    if (!["draft", "in_progress"].includes(doc.status)) throw new InterviewConflictError();
    const company = await this.company(organizationId, doc.companyId),
      discovery = await this.validatedDiscovery(organizationId, doc.companyId);
    if (
      !company ||
      company.deletedAt !== null ||
      !discovery ||
      discovery.id !== doc.discoverySessionId
    )
      throw new InterviewValidationError("Validated company context unavailable");
    return doc;
  }
  async assertLock(
    organizationId: string,
    id: string,
    lockVersion: number,
    currentQuestionId?: string,
  ) {
    const doc = await this.writable(organizationId, id);
    if (doc.lockVersion !== lockVersion) throw new InterviewConflictError();
    if (
      currentQuestionId &&
      !(await this.questions(organizationId)).some((question) => question.id === currentQuestionId)
    )
      throw new InterviewNotFoundError();
    await this.writer().patch(doc._id, {
      lockVersion: lockVersion + 1,
      status: "in_progress",
      ...(currentQuestionId ? { currentQuestionId } : {}),
      updatedAt: new Date().toISOString(),
    });
  }
  private async writeAnswer(
    organizationId: string,
    sessionId: string,
    questionId: string,
    userId: string,
    value: unknown,
    confidence: "confirmed" | "uncertain" | "missing",
    skipReason: "irrelevant" | "unknown" | "deferred" | null,
  ) {
    await this.writable(organizationId, sessionId);
    if (userId !== this.scope.userId) throw new InterviewForbiddenError();
    if (!(await this.questions(organizationId)).some((question) => question.id === questionId))
      throw new InterviewNotFoundError();
    const existing = await this.ctx.db
      .query("interview_answers")
      .withIndex("by_interviewSessionId_questionId", (q) =>
        q.eq("interviewSessionId", sessionId).eq("questionId", questionId),
      )
      .unique();
    if (existing && existing.organizationId !== organizationId) throw new InterviewForbiddenError();
    const now = new Date().toISOString();
    if (existing) {
      await this.writer().patch(existing._id, {
        valueJson: json(value),
        confidence,
        skipReason,
        answeredBy: userId,
        revision: existing.revision + 1,
        updatedAt: now,
      });
      return modelRecord((await this.ctx.db.get(existing._id))!);
    }
    const id = businessId(),
      native = await this.writer().insert("interview_answers", {
        legacyKey: JSON.stringify([id]),
        id,
        organizationId,
        interviewSessionId: sessionId,
        questionId,
        valueJson: json(value),
        skipReason,
        confidence,
        answeredBy: userId,
        revision: 1,
        createdAt: now,
        updatedAt: now,
      });
    return modelRecord((await this.ctx.db.get(native))!);
  }
  async answer(
    organizationId: string,
    sessionId: string,
    questionId: string,
    userId: string,
    value: unknown,
    confidence: "confirmed" | "uncertain",
  ) {
    if (typeof value === "number" && !Number.isFinite(value))
      throw new InterviewValidationError("Answer must be finite");
    return this.writeAnswer(organizationId, sessionId, questionId, userId, value, confidence, null);
  }
  async skip(
    organizationId: string,
    sessionId: string,
    questionId: string,
    userId: string,
    reason: "irrelevant" | "unknown" | "deferred",
  ) {
    return this.writeAnswer(organizationId, sessionId, questionId, userId, null, "missing", reason);
  }
  async removeAnswer(organizationId: string, sessionId: string, questionId: string) {
    await this.writable(organizationId, sessionId);
    for (const row of (await this.answerRows(organizationId, sessionId)).filter(
      (row) => row.questionId === questionId,
    ))
      await this.writer().delete(row._id);
  }
  async removeIneligibleAnswers(
    organizationId: string,
    sessionId: string,
    eligibleQuestionIds: string[],
  ) {
    await this.writable(organizationId, sessionId);
    const allowed = new Set(eligibleQuestionIds),
      rows = (await this.answerRows(organizationId, sessionId)).filter(
        (row) => !allowed.has(row.questionId),
      );
    for (const row of rows) await this.writer().delete(row._id);
    return { count: rows.length };
  }
  async decision(
    organizationId: string,
    sessionId: string,
    questionId: string,
    decision: string,
    reason: string,
    facts: Record<string, unknown>,
  ) {
    await this.writable(organizationId, sessionId);
    const id = businessId(),
      native = await this.writer().insert("interview_decisions", {
        legacyKey: JSON.stringify([id]),
        id,
        organizationId,
        interviewSessionId: sessionId,
        questionId,
        decision,
        reason,
        factsJson: json(facts),
        createdAt: new Date().toISOString(),
      });
    return modelRecord((await this.ctx.db.get(native))!);
  }
  async storeProgress(
    organizationId: string,
    sessionId: string,
    progress: InterviewProgressResult,
  ) {
    await this.writable(organizationId, sessionId);
    const old = bounded(
      await this.ctx.db
        .query("interview_progress")
        .withIndex("by_organizationId_interviewSessionId", (q) =>
          q.eq("organizationId", organizationId).eq("interviewSessionId", sessionId),
        )
        .take(101),
      100,
    );
    for (const row of old) await this.writer().delete(row._id);
    for (const domain of progress.domains)
      await this.writer().insert("interview_progress", {
        legacyKey: JSON.stringify([sessionId, domain.domain]),
        interviewSessionId: sessionId,
        organizationId,
        domain: domain.domain,
        answeredWeight: discoveryDecimal(domain.answeredWeight, 10)!,
        requiredWeight: discoveryDecimal(domain.requiredWeight, 10)!,
        progressPercentage: discoveryDecimal(domain.progressPercentage, 5)!,
        confidencePercentage: discoveryDecimal(domain.confidencePercentage, 5)!,
        missingMandatory: domain.missingMandatory,
        ready: domain.ready,
        updatedAt: new Date().toISOString(),
      });
  }
  async timeline(
    organizationId: string,
    sessionId: string,
    actorId: string,
    eventType: string,
    metadata: Record<string, unknown> = {},
  ) {
    if (!(await this.document(organizationId, sessionId))) throw new InterviewNotFoundError();
    if (actorId !== this.scope.userId) throw new InterviewForbiddenError();
    const id = businessId(),
      native = await this.writer().insert("interview_timeline", {
        legacyKey: JSON.stringify([id]),
        id,
        organizationId,
        interviewSessionId: sessionId,
        actorId,
        eventType,
        metadataJson: json(metadata),
        createdAt: new Date().toISOString(),
      });
    return modelRecord((await this.ctx.db.get(native))!);
  }
  async complete(organizationId: string, id: string) {
    const doc = await this.writable(organizationId, id);
    const now = new Date().toISOString();
    await this.writer().patch(doc._id, {
      status: "completed",
      completedAt: now,
      lockVersion: doc.lockVersion + 1,
      updatedAt: now,
    });
    return modelRecord((await this.ctx.db.get(doc._id))!);
  }
  async validate(organizationId: string, id: string, userId: string) {
    const doc = await this.document(organizationId, id);
    if (!doc) throw new InterviewNotFoundError();
    if (!["owner", "admin"].includes(this.scope.role) || userId !== this.scope.userId)
      throw new InterviewForbiddenError();
    if (doc.status !== "completed") throw new InterviewConflictError();
    const now = new Date().toISOString();
    await this.writer().patch(doc._id, {
      status: "validated",
      validatedAt: now,
      validatedBy: userId,
      lockVersion: doc.lockVersion + 1,
      updatedAt: now,
    });
    return modelRecord((await this.ctx.db.get(doc._id))!);
  }
}
