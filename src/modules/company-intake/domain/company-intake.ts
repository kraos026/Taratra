export type IntakeStatus =
  | "DRAFT"
  | "COLLECTING"
  | "READY_FOR_INTERPRETATION"
  | "INTERPRETING"
  | "NEEDS_MORE_INFORMATION"
  | "READY_FOR_BRAIN"
  | "ANALYZED"
  | "CLOSED";

export type IntakeSourceType =
  | "OWNER_INPUT"
  | "EXECUTIVE_INTERVIEW"
  | "MANAGER_INTERVIEW"
  | "EMPLOYEE_INTERVIEW"
  | "DOCUMENT"
  | "SOP"
  | "EMAIL"
  | "SPREADSHEET"
  | "SYSTEM_EXPORT"
  | "SCREENSHOT"
  | "MANUAL_OBSERVATION"
  | "OTHER";

export type IntakeProcessingStatus = "PENDING" | "PROCESSED" | "FAILED";
export type CompanyActorRole =
  | "OWNER"
  | "CEO"
  | "CFO"
  | "COO"
  | "MANAGER"
  | "SUPERVISOR"
  | "OPERATOR"
  | "IT"
  | "FINANCE"
  | "HR"
  | "OTHER";

export interface CompanyIntakeInput {
  companyId: string;
  tenantId: string;
  legalName?: string;
  displayName?: string;
  country?: string;
  industry?: string;
  size?: string;
  siteCount?: number;
  departments?: readonly string[];
  knownSystems?: readonly string[];
  knownTools?: readonly string[];
  businessObjectives?: readonly string[];
  operationalProblems?: readonly string[];
  constraints?: readonly string[];
  status?: IntakeStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

const required = (value: string | undefined, label: string): string => {
  if (!value?.trim()) throw new Error(`${label} is required`);
  return value;
};
const immutableDate = (value: Date): Date => new Date(value.getTime());
const list = (value?: readonly string[]): readonly string[] => Object.freeze([...(value ?? [])]);

/**
 * Application read model for intake orchestration.
 *
 * @deprecated Company is the canonical persisted aggregate. This type is
 * intentionally non-persistent and must never compete with Company.
 */
export class CompanyIntake {
  readonly companyId: string;
  readonly tenantId: string;
  readonly legalName?: string;
  readonly displayName?: string;
  readonly country?: string;
  readonly industry?: string;
  readonly size?: string;
  readonly siteCount?: number;
  readonly departments: readonly string[];
  readonly knownSystems: readonly string[];
  readonly knownTools: readonly string[];
  readonly businessObjectives: readonly string[];
  readonly operationalProblems: readonly string[];
  readonly constraints: readonly string[];
  readonly status: IntakeStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(input: CompanyIntakeInput) {
    this.companyId = required(input.companyId, "Company id");
    this.tenantId = required(input.tenantId, "Tenant id");
    this.legalName = input.legalName;
    this.displayName = input.displayName;
    this.country = input.country;
    this.industry = input.industry;
    this.size = input.size;
    this.siteCount = input.siteCount;
    this.departments = list(input.departments);
    this.knownSystems = list(input.knownSystems);
    this.knownTools = list(input.knownTools);
    this.businessObjectives = list(input.businessObjectives);
    this.operationalProblems = list(input.operationalProblems);
    this.constraints = list(input.constraints);
    this.status = input.status ?? "DRAFT";
    this.createdAt = immutableDate(input.createdAt ?? new Date());
    this.updatedAt = immutableDate(input.updatedAt ?? this.createdAt);
    Object.freeze(this);
  }

  static create(input: CompanyIntakeInput): CompanyIntake {
    return new CompanyIntake(input);
  }
}

export interface IntakeSourceInput {
  sourceId: string;
  companyId: string;
  tenantId: string;
  sourceType: IntakeSourceType;
  title: string;
  origin: string;
  rawText?: string;
  fileReference?: string;
  actorId?: string;
  reliability?: number;
  processingStatus?: IntakeProcessingStatus;
  createdAt?: Date;
  receivedAt?: Date;
  metadata?: Readonly<Record<string, string>>;
}

/**
 * Ingestion envelope for adapting raw input to KnowledgeSource/
 * KnowledgeEvidence. It is not a second canonical source aggregate.
 */
export class IntakeSource {
  readonly sourceId: string;
  readonly companyId: string;
  readonly tenantId: string;
  readonly sourceType: IntakeSourceType;
  readonly title: string;
  readonly origin: string;
  readonly rawText?: string;
  readonly fileReference?: string;
  readonly actorId?: string;
  readonly reliability?: number;
  readonly processingStatus: IntakeProcessingStatus;
  readonly createdAt: Date;
  readonly receivedAt: Date;
  readonly metadata: Readonly<Record<string, string>>;

  private constructor(input: IntakeSourceInput) {
    this.sourceId = required(input.sourceId, "Source id");
    this.companyId = required(input.companyId, "Company id");
    this.tenantId = required(input.tenantId, "Tenant id");
    this.sourceType = input.sourceType;
    this.title = required(input.title, "Source title");
    this.origin = required(input.origin, "Source origin");
    this.rawText = input.rawText;
    this.fileReference = input.fileReference;
    this.actorId = input.actorId;
    if (input.reliability !== undefined && (input.reliability < 0 || input.reliability > 1))
      throw new Error("Source reliability must be between 0 and 1");
    this.reliability = input.reliability;
    this.processingStatus = input.processingStatus ?? "PENDING";
    this.createdAt = immutableDate(input.createdAt ?? new Date());
    this.receivedAt = immutableDate(input.receivedAt ?? this.createdAt);
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }

  static create(input: IntakeSourceInput): IntakeSource {
    return new IntakeSource(input);
  }
}

export interface CompanyActorInput {
  actorId: string;
  companyId: string;
  tenantId: string;
  role: CompanyActorRole;
  department?: string;
  displayName?: string;
  authorityContext?: string;
}

/** Lightweight E3/Brain actor-context DTO; not a durable participant identity. */
export class CompanyActor {
  readonly actorId: string;
  readonly companyId: string;
  readonly tenantId: string;
  readonly role: CompanyActorRole;
  readonly department?: string;
  readonly displayName?: string;
  readonly authorityContext?: string;

  private constructor(input: CompanyActorInput) {
    this.actorId = required(input.actorId, "Actor id");
    this.companyId = required(input.companyId, "Company id");
    this.tenantId = required(input.tenantId, "Tenant id");
    this.role = input.role;
    this.department = input.department;
    this.displayName = input.displayName;
    this.authorityContext = input.authorityContext;
    Object.freeze(this);
  }

  static create(input: CompanyActorInput): CompanyActor {
    return new CompanyActor(input);
  }
}

export interface IntakeSessionInput {
  sessionId: string;
  companyId: string;
  tenantId: string;
  status?: IntakeStatus;
  objective?: string;
  scope?: string;
  includedDepartments?: readonly string[];
  excludedDepartments?: readonly string[];
  startedAt?: Date;
  completedAt?: Date;
  sourceIds?: readonly string[];
  actorIds?: readonly string[];
}

/**
 * Cross-stage orchestration DTO. DiscoverySession and InterviewSession remain
 * the canonical persisted lifecycles.
 */
export class IntakeSession {
  readonly sessionId: string;
  readonly companyId: string;
  readonly tenantId: string;
  readonly status: IntakeStatus;
  readonly objective?: string;
  readonly scope?: string;
  readonly includedDepartments: readonly string[];
  readonly excludedDepartments: readonly string[];
  readonly startedAt: Date;
  readonly completedAt?: Date;
  readonly sourceIds: readonly string[];
  readonly actorIds: readonly string[];

  private constructor(input: IntakeSessionInput) {
    this.sessionId = required(input.sessionId, "Session id");
    this.companyId = required(input.companyId, "Company id");
    this.tenantId = required(input.tenantId, "Tenant id");
    this.status = input.status ?? "DRAFT";
    this.objective = input.objective;
    this.scope = input.scope;
    this.includedDepartments = list(input.includedDepartments);
    this.excludedDepartments = list(input.excludedDepartments);
    this.startedAt = immutableDate(input.startedAt ?? new Date());
    this.completedAt = input.completedAt ? immutableDate(input.completedAt) : undefined;
    this.sourceIds = list(input.sourceIds);
    this.actorIds = list(input.actorIds);
    Object.freeze(this);
  }

  static create(input: IntakeSessionInput): IntakeSession {
    return new IntakeSession(input);
  }
}

export interface CompanyIntakeSummary {
  readonly companyId: string;
  readonly tenantId: string;
  readonly companyContext: Readonly<Record<string, unknown>>;
  readonly intakeCompleteness: number;
  readonly sourcesCollected: number;
  readonly actorsInterviewed: number;
  readonly documentsProvided: number;
  readonly knownClaims: number;
  readonly knownUnknowns: readonly string[];
  readonly contradictions: readonly string[];
  readonly missingInformation: readonly string[];
  readonly readyForBrain: boolean;
}

export type IntakeReadiness =
  "NOT_READY" | "PARTIALLY_READY" | "READY_FOR_INTERPRETATION" | "READY_FOR_BRAIN";

export interface IntakeReadinessAssessment {
  readonly status: IntakeReadiness;
  readonly minimumContextAvailable: boolean;
  readonly sourceAvailable: boolean;
  readonly sourceDiversity: number;
  readonly criticalGaps: readonly string[];
  readonly contradictions: readonly string[];
  readonly unprocessedInputs: number;
}
