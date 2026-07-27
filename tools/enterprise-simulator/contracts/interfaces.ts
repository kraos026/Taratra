/**
 * Contrats uniquement. Aucune implémentation du simulateur n'est incluse dans la PR 1.
 */
export interface SeededRandom {
  integer(min: number, max: number): number;
  decimal(min: number, max: number): number;
  boolean(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  weightedPick<T>(items: readonly { value: T; weight: number }[]): T;
  shuffle<T>(items: readonly T[]): T[];
  uuid(): string;
}

export interface SimulationScenarioReference {
  id: string;
  version: number;
  seed: number;
  catalogVersion: string;
  hash: string;
}

export interface ActorQuestion {
  id: string;
  text: string;
  structuredType: string;
  domain: string;
}

export interface StructuredActorAnswer {
  questionId: string;
  actorId: string;
  value: unknown;
  knownFactIds: string[];
  uncertainty: number;
  contradictionIds: string[];
}

export interface InterviewResponder {
  answer(input: {
    question: ActorQuestion;
    actorId: string;
    scenario: SimulationScenarioReference;
    history: readonly StructuredActorAnswer[];
  }): Promise<StructuredActorAnswer>;
}

export interface RequestContext {
  correlationId: string;
  idempotencyKey?: string;
  expectedLockVersion?: number;
  timeoutMs: number;
}

export interface SnapshotReference {
  id: string;
  version: number;
  status: string;
  organizationId: string;
}

export interface AutomateXClient {
  createTestIdentity(context: RequestContext): Promise<{ accessToken: string; userId: string }>;
  createTestOrganization(context: RequestContext): Promise<{ organizationId: string }>;
  createCompany(context: RequestContext, payload: unknown): Promise<{ companyId: string }>;
  startDiscovery(context: RequestContext, companyId: string): Promise<SnapshotReference>;
  submitDiscovery(context: RequestContext, sessionId: string, payload: unknown): Promise<void>;
  validateDiscovery(context: RequestContext, sessionId: string): Promise<SnapshotReference>;
  startInterview(context: RequestContext, companyId: string): Promise<SnapshotReference>;
  submitInterviewAnswer(
    context: RequestContext,
    interviewId: string,
    answer: StructuredActorAnswer,
  ): Promise<SnapshotReference>;
  completeInterview(context: RequestContext, interviewId: string): Promise<SnapshotReference>;
  validateInterview(context: RequestContext, interviewId: string): Promise<SnapshotReference>;
  resolveReadyKnowledgeSnapshot(
    context: RequestContext,
    companyId: string,
  ): Promise<SnapshotReference>;
  buildProcessMap(context: RequestContext, knowledgeSnapshotId: string): Promise<SnapshotReference>;
  validateAndPublishProcessMap(
    context: RequestContext,
    processMap: SnapshotReference,
  ): Promise<SnapshotReference>;
  analyzeProcessMap(context: RequestContext, processMapId: string): Promise<SnapshotReference>;
  createAiOpportunities(context: RequestContext, analysisId: string): Promise<SnapshotReference>;
  createAutomationOpportunities(
    context: RequestContext,
    aiOpportunityId: string,
  ): Promise<SnapshotReference>;
  createRoi(context: RequestContext, automationOpportunityId: string): Promise<SnapshotReference>;
  createRecommendations(context: RequestContext, roiId: string): Promise<SnapshotReference>;
  getSnapshot(context: RequestContext, reference: SnapshotReference): Promise<unknown>;
  cleanupTestTenant(context: RequestContext, organizationId: string): Promise<void>;
}

export interface MatchDecision {
  expectedId: string;
  actualId: string | null;
  ruleCode: string;
  ruleVersion: number;
  matched: boolean;
  score: number;
  explanation: string;
}

export interface ValidationEngine {
  compare(input: {
    scenario: SimulationScenarioReference;
    groundTruth: unknown;
    snapshots: readonly SnapshotReference[];
  }): Promise<{ decisions: MatchDecision[]; metrics: Record<string, number> }>;
}

export interface SimulationReport {
  runId: string;
  scenario: SimulationScenarioReference;
  automatexCommitSha: string;
  status: "PASSED" | "PASSED_WITH_WARNINGS" | "FAILED" | "INFRASTRUCTURE_ERROR";
  score: number;
  metrics: Record<string, number>;
  snapshots: SnapshotReference[];
  decisions: MatchDecision[];
  errors: string[];
  warnings: string[];
}
