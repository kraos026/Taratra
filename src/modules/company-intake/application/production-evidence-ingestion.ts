import { IntakeInterpretationAdapter } from "./intake-interpretation-adapter";
import type { AIProvider } from "../../../brain-evaluation/ai-interpretation-gateway";
import type { EnterpriseEvidenceRecord } from "../../../brain-evaluation/convergence-adapters";
import { IntakeSession, IntakeSource } from "../domain/company-intake";

export type ProductionEvidenceSourceType =
  | "DOCUMENT"
  | "SOP"
  | "SPREADSHEET"
  | "CSV_EXPORT"
  | "SYSTEM_EXPORT"
  | "EMAIL"
  | "REPORT"
  | "SCREENSHOT"
  | "PROCESS_EVIDENCE"
  | "OTHER";

export interface StructuredEvidence {
  readonly columns: readonly string[];
  readonly rows: readonly Readonly<Record<string, unknown>>[];
  readonly units?: Readonly<Record<string, string>>;
  readonly timestamps?: readonly string[];
}

export interface EvidenceChunk {
  readonly chunkId: string;
  readonly sourceId: string;
  readonly sourceVersion: number;
  readonly content: string;
  readonly location: Readonly<{
    lineStart?: number;
    lineEnd?: number;
    sheet?: string;
    range?: string;
  }>;
  readonly structured?: StructuredEvidence;
}

export interface IngestProductionEvidenceCommand {
  readonly tenantId: string;
  readonly companyId: string;
  readonly sourceId: string;
  readonly sourceVersion: number;
  readonly sourceType: ProductionEvidenceSourceType;
  readonly rawContent?: string;
  readonly structured?: StructuredEvidence;
  readonly origin: string;
  readonly authorOrSystem?: string;
  readonly receivedAt: Date;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly sessionId?: string;
  readonly chunkSize?: number;
}

export interface ProductionEvidenceIngestionPort {
  isVersionIngested(input: {
    tenantId: string;
    companyId: string;
    sourceId: string;
    sourceVersion: number;
  }): Promise<boolean>;
  persistSource(input: {
    tenantId: string;
    companyId: string;
    sourceId: string;
    sourceVersion: number;
    sourceType: ProductionEvidenceSourceType;
    rawContent?: string;
    structured?: StructuredEvidence;
    origin: string;
    authorOrSystem?: string;
    receivedAt: Date;
    metadata: Readonly<Record<string, string>>;
  }): Promise<void>;
  persistEvidence(records: readonly EnterpriseEvidenceRecord[]): Promise<void>;
}

export interface ProductionEvidenceIngestionResult {
  readonly tenantId: string;
  readonly companyId: string;
  readonly sourceId: string;
  readonly sourceVersion: number;
  readonly duplicate: boolean;
  readonly chunks: readonly EvidenceChunk[];
  readonly evidenceIds: readonly string[];
  readonly candidateIds: readonly string[];
}

/** Ingests production sources without becoming a second Knowledge repository. */
export class ProductionEvidenceIngestionService {
  constructor(
    private readonly repository: ProductionEvidenceIngestionPort,
    private readonly aiProvider?: AIProvider,
  ) {}

  async ingest(
    command: IngestProductionEvidenceCommand,
  ): Promise<ProductionEvidenceIngestionResult> {
    validateCommand(command);
    const identity = {
      tenantId: command.tenantId,
      companyId: command.companyId,
      sourceId: command.sourceId,
      sourceVersion: command.sourceVersion,
    };
    if (await this.repository.isVersionIngested(identity))
      return Object.freeze({
        ...identity,
        duplicate: true,
        chunks: [],
        evidenceIds: [],
        candidateIds: [],
      });
    const chunks = chunk(command);
    await this.repository.persistSource({
      ...command,
      metadata: Object.freeze({
        ...(command.metadata ?? {}),
        sourceVersion: String(command.sourceVersion),
      }),
    });
    const baseRecords = chunks.map((item) => this.toRecord(command, item));
    const interpreted = await this.interpret(command, chunks);
    await this.repository.persistEvidence([...baseRecords, ...interpreted.records]);
    return Object.freeze({
      ...identity,
      duplicate: false,
      chunks,
      evidenceIds: Object.freeze(
        [...baseRecords, ...interpreted.records].map((record) => record.id),
      ),
      candidateIds: interpreted.candidateIds,
    });
  }

  private async interpret(
    command: IngestProductionEvidenceCommand,
    chunks: readonly EvidenceChunk[],
  ) {
    if (!this.aiProvider || !command.rawContent?.trim() || !command.sessionId)
      return { records: [] as EnterpriseEvidenceRecord[], candidateIds: [] as readonly string[] };
    const adapter = new IntakeInterpretationAdapter(this.aiProvider);
    const records: EnterpriseEvidenceRecord[] = [];
    const candidateIds: string[] = [];
    for (const chunk of chunks) {
      const result = await adapter.interpret(
        IntakeSource.create({
          sourceId: chunk.chunkId,
          tenantId: command.tenantId,
          companyId: command.companyId,
          sourceType: intakeSourceType(command.sourceType),
          title: command.sourceId,
          origin: command.origin,
          rawText: chunk.content,
          metadata: { sourceVersion: String(command.sourceVersion) },
        }),
        IntakeSession.create({
          sessionId: command.sessionId,
          tenantId: command.tenantId,
          companyId: command.companyId,
        }),
      );
      for (const candidate of result.interpretation.candidates) {
        candidateIds.push(candidate.candidateId);
        records.push({
          id: `candidate:${candidate.candidateId}`,
          sourceType: "DOCUMENT",
          sourceReference: candidate.sourceReference,
          sourceModule: "enterprise_knowledge",
          capturedAt: command.receivedAt,
          reliability: 0.5,
          content: candidate.statement,
          provenance: {
            sourceId: command.sourceId,
            sourceVersion: command.sourceVersion,
            chunkId: chunk.chunkId,
            candidateId: candidate.candidateId,
          },
          tenantId: command.tenantId,
          companyId: command.companyId,
          claim: {
            id: `claim:${candidate.candidateId}`,
            statement: candidate.statement,
            kind: candidate.candidateType === "UNKNOWN_CANDIDATE" ? "UNKNOWN" : "INFERENCE",
          },
        });
      }
    }
    return { records, candidateIds: Object.freeze(candidateIds) };
  }

  private toRecord(
    command: IngestProductionEvidenceCommand,
    chunkValue: EvidenceChunk,
  ): EnterpriseEvidenceRecord {
    return {
      id: `evidence:${command.sourceId}:v${command.sourceVersion}:${chunkValue.chunkId}`,
      sourceType: command.structured
        ? "SYSTEM_RECORD"
        : command.sourceType === "EMAIL"
          ? "INTERVIEW"
          : "DOCUMENT",
      sourceReference: command.origin,
      sourceModule: "enterprise_knowledge",
      capturedAt: command.receivedAt,
      reliability: reliabilityFor(command.sourceType),
      content: chunkValue.content,
      structuredValue: chunkValue.structured,
      provenance: {
        tenantId: command.tenantId,
        companyId: command.companyId,
        sourceId: command.sourceId,
        sourceVersion: command.sourceVersion,
        chunkId: chunkValue.chunkId,
        location: chunkValue.location,
        authorOrSystem: command.authorOrSystem,
      },
      tenantId: command.tenantId,
      companyId: command.companyId,
    };
  }
}

export type EvidenceRequestTarget = "SYSTEM_EVIDENCE" | "KNOWLEDGE_DOCUMENT";
export interface EvidenceAcquisitionRequest {
  readonly requestId: string;
  readonly tenantId: string;
  readonly companyId: string;
  readonly target: EvidenceRequestTarget;
  readonly requestedEvidenceType: string;
  readonly reason: string;
  readonly gapId: string;
  readonly actionId: string;
  readonly status: "REQUESTED" | "FULFILLED" | "CANCELLED";
}

/** Application envelope for F2 unsupported targets; not a new aggregate. */
export class EvidenceAcquisitionRequestService {
  private readonly requests = new Map<string, EvidenceAcquisitionRequest>();

  create(
    input: Omit<EvidenceAcquisitionRequest, "requestId" | "status">,
  ): EvidenceAcquisitionRequest {
    if (!input.tenantId || !input.companyId) throw new Error("Tenant and company are required");
    const requestId = `${input.tenantId}:${input.companyId}:${input.actionId}`;
    const existing = this.requests.get(requestId);
    if (existing) return existing;
    const request = Object.freeze({ ...input, requestId, status: "REQUESTED" as const });
    this.requests.set(requestId, request);
    return request;
  }

  fulfill(requestId: string): EvidenceAcquisitionRequest {
    const request = this.requests.get(requestId);
    if (!request) throw new Error("Evidence request was not found");
    const fulfilled = Object.freeze({ ...request, status: "FULFILLED" as const });
    this.requests.set(requestId, fulfilled);
    return fulfilled;
  }
}

function chunk(command: IngestProductionEvidenceCommand): readonly EvidenceChunk[] {
  if (command.structured) {
    const size = Math.max(1, command.chunkSize ?? 100);
    const chunks: EvidenceChunk[] = [];
    for (let index = 0; index < command.structured.rows.length; index += size) {
      const rows = command.structured.rows.slice(index, index + size);
      const structured = Object.freeze({ ...command.structured, rows: Object.freeze([...rows]) });
      chunks.push(
        Object.freeze({
          chunkId: `${command.sourceId}:v${command.sourceVersion}:rows${index + 1}-${index + rows.length}`,
          sourceId: command.sourceId,
          sourceVersion: command.sourceVersion,
          content: JSON.stringify({ columns: command.structured.columns, rows }),
          location: Object.freeze({ range: `rows:${index + 1}-${index + rows.length}` }),
          structured,
        }),
      );
    }
    return Object.freeze(chunks);
  }
  const content = command.rawContent ?? "";
  const size = Math.max(1, command.chunkSize ?? 4000);
  const chunks: EvidenceChunk[] = [];
  for (let offset = 0; offset < content.length; offset += size) {
    const value = content.slice(offset, offset + size);
    const lineStart = content.slice(0, offset).split("\n").length;
    const lineEnd = lineStart + value.split("\n").length - 1;
    chunks.push(
      Object.freeze({
        chunkId: `${command.sourceId}:v${command.sourceVersion}:chunk${chunks.length + 1}`,
        sourceId: command.sourceId,
        sourceVersion: command.sourceVersion,
        content: value,
        location: Object.freeze({ lineStart, lineEnd }),
      }),
    );
  }
  return Object.freeze(chunks);
}

function validateCommand(command: IngestProductionEvidenceCommand) {
  if (!command.tenantId || !command.companyId || !command.sourceId)
    throw new Error("Evidence scope is required");
  if (!Number.isInteger(command.sourceVersion) || command.sourceVersion < 1)
    throw new Error("Source version must be positive");
  if (!command.rawContent && !command.structured)
    throw new Error("Raw or structured source content is required");
}

function reliabilityFor(type: ProductionEvidenceSourceType): number {
  if (["SYSTEM_EXPORT", "CSV_EXPORT", "PROCESS_EVIDENCE"].includes(type)) return 0.9;
  if (["SOP", "REPORT"].includes(type)) return 0.8;
  if (type === "EMAIL") return 0.6;
  return 0.5;
}

function intakeSourceType(
  type: ProductionEvidenceSourceType,
): "DOCUMENT" | "SOP" | "EMAIL" | "SPREADSHEET" | "SYSTEM_EXPORT" | "SCREENSHOT" | "OTHER" {
  if (type === "CSV_EXPORT" || type === "REPORT") return "DOCUMENT";
  if (type === "PROCESS_EVIDENCE") return "SYSTEM_EXPORT";
  return type === "DOCUMENT" ||
    type === "SOP" ||
    type === "EMAIL" ||
    type === "SPREADSHEET" ||
    type === "SYSTEM_EXPORT" ||
    type === "SCREENSHOT"
    ? type
    : "OTHER";
}
