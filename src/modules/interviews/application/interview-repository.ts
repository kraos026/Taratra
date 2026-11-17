import type {
  DiscoverySession,
  InterviewSession,
  InterviewAnswer,
  InterviewDecision,
  InterviewTimeline,
} from "../../../generated/prisma/client";
import type { OrganizationContext } from "../../companies/domain/company";
import type {
  InterviewAnswerValue,
  InterviewProgressResult,
  InterviewQuestionDefinition,
} from "../domain/interview-engine";
export interface InterviewRepository {
  context(userId: string): Promise<OrganizationContext | null>;
  validatedDiscovery(organizationId: string, companyId: string): Promise<DiscoverySession | null>;
  latest(organizationId: string, companyId: string): Promise<InterviewSession | null>;
  session(organizationId: string, id: string): Promise<InterviewSession | null>;
  create(
    organizationId: string,
    companyId: string,
    discoverySessionId: string,
    userId: string,
    version: number,
  ): Promise<InterviewSession>;
  discoveryFacts(
    organizationId: string,
    companyId: string,
  ): Promise<{
    industry: string | null;
    countryCode: string | null;
    employeeCount: number | null;
    businessModel: string | null;
    growthStage: string | null;
    softwareCount: number;
    processCount: number;
  }>;
  questions(organizationId: string): Promise<InterviewQuestionDefinition[]>;
  answers(organizationId: string, sessionId: string): Promise<InterviewAnswerValue[]>;
  assertLock(
    organizationId: string,
    id: string,
    lockVersion: number,
    currentQuestionId?: string,
  ): Promise<void>;
  answer(
    organizationId: string,
    sessionId: string,
    questionId: string,
    userId: string,
    value: unknown,
    confidence: "confirmed" | "uncertain",
  ): Promise<InterviewAnswer>;
  skip(
    organizationId: string,
    sessionId: string,
    questionId: string,
    userId: string,
    reason: "irrelevant" | "unknown" | "deferred",
  ): Promise<InterviewAnswer>;
  removeAnswer(organizationId: string, sessionId: string, questionId: string): Promise<void>;
  removeIneligibleAnswers(
    organizationId: string,
    sessionId: string,
    eligibleQuestionIds: string[],
  ): Promise<{ count: number }>;
  decision(
    organizationId: string,
    sessionId: string,
    questionId: string,
    decision: string,
    reason: string,
    facts: Record<string, unknown>,
  ): Promise<InterviewDecision>;
  storeProgress(
    organizationId: string,
    sessionId: string,
    progress: InterviewProgressResult,
  ): Promise<void>;
  timeline(
    organizationId: string,
    sessionId: string,
    actorId: string,
    eventType: string,
    metadata?: Record<string, unknown>,
  ): Promise<InterviewTimeline>;
  complete(organizationId: string, id: string): Promise<InterviewSession>;
  validate(organizationId: string, id: string, userId: string): Promise<InterviewSession>;
}
