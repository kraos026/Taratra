import { describe, expect, it } from "vitest";
import {
  EvidenceAcquisitionRequestService,
  ProductionEvidenceIngestionService,
  type ProductionEvidenceIngestionPort,
} from "./index";
import type { EnterpriseEvidenceRecord } from "../../brain-evaluation/convergence-adapters";
import type { AIProvider } from "../../brain-evaluation/ai-interpretation-gateway";

class MemoryEvidenceRepository implements ProductionEvidenceIngestionPort {
  readonly sources: unknown[] = [];
  readonly evidence: EnterpriseEvidenceRecord[] = [];
  async isVersionIngested(input: {
    tenantId: string;
    companyId: string;
    sourceId: string;
    sourceVersion: number;
  }) {
    return this.sources.some((source) => {
      const value = source as {
        tenantId: string;
        companyId: string;
        sourceId: string;
        sourceVersion: number;
      };
      return (
        value.tenantId === input.tenantId &&
        value.companyId === input.companyId &&
        value.sourceId === input.sourceId &&
        value.sourceVersion === input.sourceVersion
      );
    });
  }
  async persistSource(input: Parameters<ProductionEvidenceIngestionPort["persistSource"]>[0]) {
    this.sources.push(input);
  }
  async persistEvidence(records: readonly EnterpriseEvidenceRecord[]) {
    this.evidence.push(...records);
  }
}

const command = (overrides: Record<string, unknown> = {}) => ({
  tenantId: "tenant-a",
  companyId: "company-a",
  sourceId: "sop-1",
  sourceVersion: 1,
  sourceType: "SOP" as const,
  rawContent: "Step one\nStep two",
  origin: "upload://sop-1",
  receivedAt: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
});

const provider: AIProvider = {
  providerId: "test",
  async interpret(request) {
    return {
      requestId: request.requestId,
      provider: "test",
      model: "test",
      task: request.task,
      schemaVersion: request.schemaVersion,
      candidates: [
        {
          candidateId: "candidate-1",
          candidateType: "FACT_CANDIDATE",
          statement: "A step exists",
          sourceReference: request.sourceId + ":excerpt",
          sourceExcerpt: "Step one",
          rationale: "observed",
          knowledgeReferences: [],
          status: "AI_DERIVED",
          review: "REQUIRED",
        },
      ],
      sourceReferences: [request.sourceId],
      warnings: [],
      validationIssues: [],
      createdAt: new Date("2026-01-01T00:00:00Z"),
    };
  },
};

describe("production evidence ingestion", () => {
  it("preserves SOP raw content, bounded chunks and provenance", async () => {
    const repository = new MemoryEvidenceRepository();
    const result = await new ProductionEvidenceIngestionService(repository).ingest(
      command({ chunkSize: 8 }),
    );
    expect(result.duplicate).toBe(false);
    expect(repository.sources[0]).toMatchObject({
      rawContent: "Step one\nStep two",
      sourceVersion: 1,
    });
    expect(result.chunks.length).toBeGreaterThan(1);
    expect(repository.evidence[0].provenance).toMatchObject({
      tenantId: "tenant-a",
      companyId: "company-a",
      sourceId: "sop-1",
      sourceVersion: 1,
    });
  });

  it("preserves structured CSV rows, columns and row provenance", async () => {
    const repository = new MemoryEvidenceRepository();
    await new ProductionEvidenceIngestionService(repository).ingest(
      command({
        sourceId: "csv-1",
        sourceType: "CSV_EXPORT",
        rawContent: undefined,
        structured: {
          columns: ["id", "amount"],
          rows: [{ id: "r1", amount: 12 }],
          units: { amount: "EUR" },
        },
      }),
    );
    expect(repository.evidence[0].structuredValue).toMatchObject({
      columns: ["id", "amount"],
      rows: [{ id: "r1", amount: 12 }],
    });
    expect(repository.evidence[0].provenance).toMatchObject({
      sourceVersion: 1,
      location: { range: "rows:1-1" },
    });
  });

  it("deduplicates exact source versions and accepts a new version", async () => {
    const repository = new MemoryEvidenceRepository();
    const service = new ProductionEvidenceIngestionService(repository);
    await service.ingest(command());
    expect((await service.ingest(command())).duplicate).toBe(true);
    expect((await service.ingest(command({ sourceVersion: 2 }))).duplicate).toBe(false);
    expect(repository.sources).toHaveLength(2);
  });

  it("keeps AI interpretation non-authoritative and source grounded", async () => {
    const repository = new MemoryEvidenceRepository();
    const result = await new ProductionEvidenceIngestionService(repository, provider).ingest(
      command({ sessionId: "session-1" }),
    );
    const interpreted = repository.evidence.find((record) => record.id.startsWith("candidate:"));
    expect(result.candidateIds).toEqual(["candidate-1"]);
    expect(interpreted?.claim?.kind).toBe("INFERENCE");
    expect(interpreted?.provenance).toMatchObject({ chunkId: "sop-1:v1:chunk1" });
  });

  it("supports system and knowledge document acquisition requests idempotently", () => {
    const service = new EvidenceAcquisitionRequestService();
    const input = {
      tenantId: "tenant-a",
      companyId: "company-a",
      target: "SYSTEM_EVIDENCE" as const,
      requestedEvidenceType: "SYSTEM_EXPORT",
      reason: "close gap",
      gapId: "gap-1",
      actionId: "action-1",
    };
    expect(service.create(input)).toEqual(service.create(input));
    expect(service.fulfill("tenant-a:company-a:action-1").status).toBe("FULFILLED");
    expect(
      service.create({ ...input, target: "KNOWLEDGE_DOCUMENT", actionId: "action-2" }).target,
    ).toBe("KNOWLEDGE_DOCUMENT");
    expect(() => service.create({ ...input, tenantId: "" })).toThrow();
  });

  it("supports process evidence without changing the canonical target models", async () => {
    const repository = new MemoryEvidenceRepository();
    await new ProductionEvidenceIngestionService(repository).ingest(
      command({ sourceType: "PROCESS_EVIDENCE", sourceId: "process-1" }),
    );
    expect(repository.evidence[0].provenance).toMatchObject({
      sourceId: "process-1",
      companyId: "company-a",
    });
  });

  it("keeps contradictory raw measurements as separate evidence, never an average", async () => {
    const repository = new MemoryEvidenceRepository();
    await new ProductionEvidenceIngestionService(repository).ingest(
      command({
        sourceId: "report-1",
        sourceType: "REPORT",
        rawContent: "Average handling time: 10 minutes\nAverage handling time: 30 minutes",
      }),
    );
    expect(repository.evidence).toHaveLength(1);
    expect(repository.evidence[0].content).toContain("10 minutes");
    expect(repository.evidence[0].content).toContain("30 minutes");
    expect(repository.evidence[0].content).not.toContain("20 minutes");
  });

  it("keeps identical source identifiers isolated across companies", async () => {
    const repository = new MemoryEvidenceRepository();
    const service = new ProductionEvidenceIngestionService(repository);
    await service.ingest(command({ companyId: "company-a" }));
    await service.ingest(command({ companyId: "company-b" }));
    expect(repository.sources).toHaveLength(2);
    expect(repository.evidence.every((record) => record.tenantId === "tenant-a")).toBe(true);
    expect(new Set(repository.evidence.map((record) => record.companyId))).toEqual(
      new Set(["company-a", "company-b"]),
    );
  });
});
