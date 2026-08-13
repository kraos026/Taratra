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
        where: { organizationId: "org", companyId: "company", status: "validated" },
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
    db.knowledgeSource.create.mockResolvedValue({ id: "source" });
    db.knowledgeSnapshot.update.mockResolvedValue(readySnapshot(8, "new"));
    const repository = new PrismaKnowledgeRepository(asDb(db));
    const result = await repository.persist("org", "company", "user", {
      ...projection,
      sources: [projection.sources[0]!],
    });
    expect(result).toMatchObject({ created: true, snapshot: { id: "new", version: 8 } });
    expect(db.knowledgeSnapshot.create).toHaveBeenCalledWith({
      data: { organizationId: "org", companyId: "company", createdBy: "user", version: 8 },
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
    expect(db.knowledgeSource.create).not.toHaveBeenCalled();
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
    knowledgeSource: { findMany: vi.fn(), create: vi.fn() },
    knowledgeNode: { create: vi.fn() },
    knowledgeFact: { create: vi.fn() },
    knowledgeEvidence: { create: vi.fn() },
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
