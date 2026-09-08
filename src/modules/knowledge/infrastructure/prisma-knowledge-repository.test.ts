import { describe, expect, it, vi } from "vitest";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import type { KnowledgeProjection } from "../domain/knowledge-projection";
import { PrismaKnowledgeRepository } from "./prisma-knowledge-repository";

const projection: KnowledgeProjection = {
  sources: [
    {
      key: "discovery",
      type: "discovery",
      sourceId: "11111111-1111-4111-8111-111111111111",
      version: 4,
      validatedAt: new Date("2026-08-01"),
    },
    {
      key: "interview",
      type: "interview",
      sourceId: "22222222-2222-4222-8222-222222222222",
      version: 2,
      validatedAt: new Date("2026-08-02"),
    },
  ],
  nodes: [],
  facts: [],
  relationships: [],
};

const projectionWithFacts: KnowledgeProjection = {
  ...projection,
  nodes: [
    {
      key: "process:invoice",
      type: "process",
      domain: "finance",
      label: "Invoice processing",
      canonicalEntityType: "business_process",
      canonicalEntityId: "33333333-3333-4333-8333-333333333333",
      confidence: 92,
    },
  ],
  facts: Array.from({ length: 29 }, (_, index) => ({
    key: `fact:${index + 1}`,
    domain: "finance",
    nodeKey: "process:invoice",
    value: { metric: index + 1 },
    valueType: "object",
    confidence: 80 + (index % 10),
    sourceKey: index % 2 === 0 ? "discovery" : "interview",
    sourceRecordType: index % 2 === 0 ? "discovery_session" : "interview_answer",
    sourceRecordId:
      index % 2 === 0
        ? "11111111-1111-4111-8111-111111111111"
        : "22222222-2222-4222-8222-222222222222",
    evidenceType: index % 2 === 0 ? "validated_entity" : "validated_answer",
  })),
  relationships: [
    {
      fromNodeKey: "process:invoice",
      toNodeKey: "process:invoice",
      type: "self_reference_for_test",
      confidence: 75,
    },
  ],
};

describe("PrismaKnowledgeRepository production identity", () => {
  it("selects only validated Discovery and Interview versions", async () => {
    const db = database();
    db.discoverySession = {
      findFirst: vi.fn().mockResolvedValue({
        id: "discovery",
        version: 3,
        status: "validated",
        validatedAt: new Date("2026-08-01"),
      }),
    };
    db.companyProfile = {
      findFirst: vi.fn().mockResolvedValue({
        industry: null,
        countryCode: null,
        employeeCount: null,
        businessModel: null,
        growthStage: null,
      }),
    };
    db.department = { findMany: vi.fn().mockResolvedValue([]) };
    db.companyRole = { findMany: vi.fn().mockResolvedValue([]) };
    db.companySoftware = { findMany: vi.fn().mockResolvedValue([]) };
    db.businessProcess = { findMany: vi.fn().mockResolvedValue([]) };
    db.interviewSession = { findFirst: vi.fn().mockResolvedValue(null) };
    const result = await new PrismaKnowledgeRepository(asDb(db)).inputs("org", "company");
    expect(result.discovery?.session.version).toBe(3);
    expect(result.interview).toBeNull();
    expect(db.discoverySession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org", companyId: "company", status: "validated" },
      }),
    );
    expect(db.interviewSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org",
          companyId: "company",
          discoverySessionId: "discovery",
          status: "validated",
        },
      }),
    );
  });

  it("uses tenant and company together when checking existence", async () => {
    const db = database();
    db.company.findFirst.mockResolvedValue({ id: "company" });
    const repository = new PrismaKnowledgeRepository(asDb(db));
    await expect(repository.companyExists("org", "company")).resolves.toBe(true);
    expect(db.company.findFirst).toHaveBeenCalledWith({
      where: { id: "company", organizationId: "org" },
      select: { id: true },
    });
  });

  it("reuses the same READY snapshot for an identical source set", async () => {
    const db = database();
    const ready = readySnapshot(7);
    db.knowledgeSnapshot.findFirst.mockResolvedValueOnce(ready);
    db.knowledgeSource.findMany.mockResolvedValue([
      { sourceType: "interview", sourceId: projection.sources[1]!.sourceId, sourceVersion: 2 },
      { sourceType: "discovery", sourceId: projection.sources[0]!.sourceId, sourceVersion: 4 },
    ]);
    const repository = new PrismaKnowledgeRepository(asDb(db));
    await expect(repository.persist("org", "company", "user", projection)).resolves.toEqual({
      snapshot: ready,
      created: false,
    });
    expect(db.knowledgeSnapshot.create).not.toHaveBeenCalled();
  });

  it("creates a new version when a canonical source changes", async () => {
    const db = database();
    db.knowledgeSnapshot.findFirst
      .mockResolvedValueOnce(readySnapshot(7))
      .mockResolvedValueOnce({ version: 7 });
    db.knowledgeSource.findMany.mockResolvedValue([
      { sourceType: "discovery", sourceId: projection.sources[0]!.sourceId, sourceVersion: 3 },
    ]);
    db.knowledgeSnapshot.create.mockResolvedValue({ id: "new", version: 8 });
    db.knowledgeSnapshot.update.mockResolvedValue(readySnapshot(8, "new"));
    const repository = new PrismaKnowledgeRepository(asDb(db));
    const result = await repository.persist("org", "company", "user", {
      ...projection,
      sources: [projection.sources[0]!],
    });
    expect(result).toMatchObject({ created: true, snapshot: { id: "new", version: 8 } });
    expect(db.knowledgeSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: expect.any(String),
        organizationId: "org",
        companyId: "company",
        createdBy: "user",
        version: 8,
      }),
    });
    expect(db.knowledgeSource.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          id: expect.any(String),
          organizationId: "org",
          snapshotId: "new",
          sourceType: "discovery",
        }),
      ],
    });
  });

  it("checks idempotence only after acquiring the transaction advisory lock", async () => {
    const order: string[] = [];
    const db = database();
    db.$executeRaw.mockImplementation(async () => {
      order.push("lock");
      return 1;
    });
    db.knowledgeSnapshot.findFirst.mockImplementation(async () => {
      order.push("lookup");
      return readySnapshot(1);
    });
    db.knowledgeSource.findMany.mockResolvedValue(
      projection.sources.map((source) => ({
        sourceType: source.type,
        sourceId: source.sourceId,
        sourceVersion: source.version,
      })),
    );
    await new PrismaKnowledgeRepository(asDb(db)).persist("org", "company", "user", projection);
    expect(order).toEqual(["lock", "lookup"]);
  });

  it("does not mutate an existing READY snapshot", async () => {
    const db = database();
    db.knowledgeSnapshot.findFirst.mockResolvedValue(readySnapshot(1));
    db.knowledgeSource.findMany.mockResolvedValue(
      projection.sources.map((source) => ({
        sourceType: source.type,
        sourceId: source.sourceId,
        sourceVersion: source.version,
      })),
    );
    await new PrismaKnowledgeRepository(asDb(db)).persist("org", "company", "user", projection);
    expect(db.knowledgeSnapshot.update).not.toHaveBeenCalled();
    expect(db.knowledgeSource.createMany).not.toHaveBeenCalled();
  });

  it("persists canonical invoice facts, evidence, provenance, and relationships in batches", async () => {
    const db = database();
    db.knowledgeSnapshot.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ version: 0 });
    db.knowledgeSnapshot.create.mockResolvedValue({ id: "snapshot", version: 1 });
    db.knowledgeSnapshot.update.mockResolvedValue(readySnapshot(1, "snapshot"));

    const result = await new PrismaKnowledgeRepository(asDb(db)).persist(
      "org",
      "company",
      "user",
      projectionWithFacts,
    );

    expect(result.created).toBe(true);
    expect(db.knowledgeSource.createMany).toHaveBeenCalledOnce();
    expect(db.knowledgeNode.createMany).toHaveBeenCalledOnce();
    expect(db.knowledgeFact.createMany).toHaveBeenCalledOnce();
    expect(db.knowledgeEvidence.createMany).toHaveBeenCalledOnce();
    expect(db.knowledgeRelationship.createMany).toHaveBeenCalledOnce();
    expect(db.knowledgeFact.create).not.toHaveBeenCalled();
    expect(db.knowledgeEvidence.create).not.toHaveBeenCalled();

    const factRows = db.knowledgeFact.createMany.mock.calls[0]?.[0].data;
    const evidenceRows = db.knowledgeEvidence.createMany.mock.calls[0]?.[0].data;
    const relationshipRows = db.knowledgeRelationship.createMany.mock.calls[0]?.[0].data;
    expect(factRows).toHaveLength(29);
    expect(evidenceRows).toHaveLength(29);
    expect(relationshipRows).toHaveLength(1);
    expect(evidenceRows?.[0]).toMatchObject({
      id: expect.any(String),
      organizationId: "org",
      snapshotId: "snapshot",
      factId: factRows?.[0]?.id,
      sourceRecordType: "discovery_session",
      sourceRecordId: "11111111-1111-4111-8111-111111111111",
      evidenceType: "validated_entity",
    });
    expect(evidenceRows?.[1]).toMatchObject({
      factId: factRows?.[1]?.id,
      sourceRecordType: "interview_answer",
      sourceRecordId: "22222222-2222-4222-8222-222222222222",
      evidenceType: "validated_answer",
    });
  });

  it("does not mark the snapshot ready when a batched evidence stage fails", async () => {
    const db = database();
    db.knowledgeSnapshot.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ version: 0 });
    db.knowledgeSnapshot.create.mockResolvedValue({ id: "snapshot", version: 1 });
    db.knowledgeEvidence.createMany.mockRejectedValue(new Error("evidence batch failed"));

    await expect(
      new PrismaKnowledgeRepository(asDb(db)).persist(
        "org",
        "company",
        "user",
        projectionWithFacts,
      ),
    ).rejects.toThrow("evidence batch failed");

    expect(db.knowledgeSnapshot.update).not.toHaveBeenCalled();
  });

  it("marks the snapshot ready only after all required batched writes complete", async () => {
    const order: string[] = [];
    const db = database();
    db.knowledgeSnapshot.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ version: 0 });
    db.knowledgeSnapshot.create.mockImplementation(async () => {
      order.push("snapshot");
      return { id: "snapshot", version: 1 };
    });
    db.knowledgeSource.createMany.mockImplementation(async () => {
      order.push("sources");
      return { count: 2 };
    });
    db.knowledgeNode.createMany.mockImplementation(async () => {
      order.push("nodes");
      return { count: 1 };
    });
    db.knowledgeFact.createMany.mockImplementation(async () => {
      order.push("facts");
      return { count: 29 };
    });
    db.knowledgeEvidence.createMany.mockImplementation(async () => {
      order.push("evidence");
      return { count: 29 };
    });
    db.knowledgeRelationship.createMany.mockImplementation(async () => {
      order.push("relationships");
      return { count: 1 };
    });
    db.knowledgeSnapshot.update.mockImplementation(async () => {
      order.push("ready");
      return readySnapshot(1, "snapshot");
    });

    await new PrismaKnowledgeRepository(asDb(db)).persist(
      "org",
      "company",
      "user",
      projectionWithFacts,
    );

    expect(order).toEqual([
      "snapshot",
      "sources",
      "nodes",
      "facts",
      "evidence",
      "relationships",
      "ready",
    ]);
  });
});

function readySnapshot(version: number, id = "ready") {
  return {
    id,
    organizationId: "org",
    companyId: "company",
    version,
    status: "ready",
    schemaVersion: 1,
    generatedAt: new Date("2026-08-09"),
    createdBy: "user",
    createdAt: new Date("2026-08-09"),
    updatedAt: new Date("2026-08-09"),
  };
}

function database() {
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    company: { findFirst: vi.fn() },
    knowledgeSnapshot: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    knowledgeSource: { findMany: vi.fn(), createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    knowledgeNode: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    knowledgeFact: { create: vi.fn(), createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    knowledgeEvidence: { create: vi.fn(), createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    knowledgeRelationship: { createMany: vi.fn() },
    discoverySession: { findFirst: vi.fn() },
    companyProfile: { findFirst: vi.fn() },
    department: { findMany: vi.fn() },
    companyRole: { findMany: vi.fn() },
    companySoftware: { findMany: vi.fn() },
    businessProcess: { findMany: vi.fn() },
    interviewSession: { findFirst: vi.fn() },
    interviewAnswer: { findMany: vi.fn() },
    interviewQuestion: { findMany: vi.fn() },
  };
}

function asDb(db: ReturnType<typeof database>): TransactionClient {
  return db as unknown as TransactionClient;
}
