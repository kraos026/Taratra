import { describe, expect, it, vi } from "vitest";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import type { ProcessBuild } from "../domain/process-mapping-engine";
import { PrismaProcessMapRepository } from "./prisma-process-map-repository";

describe("PrismaProcessMapRepository", () => {
  it("batches process map child nodes while preserving edge provenance", async () => {
    const db = {
      $executeRaw: vi.fn(),
      processMap: {
        findFirst: vi.fn().mockResolvedValue({ versionNumber: 3 }),
        create: vi.fn().mockResolvedValue({ id: "00000000-0000-4000-8000-000000000010" }),
      },
      processMapNode: { createMany: vi.fn() },
      processMapEdge: { createMany: vi.fn() },
      processMapOwnership: { create: vi.fn() },
      processMapValidation: { createMany: vi.fn() },
      processMapFactUsage: { createMany: vi.fn() },
    };

    const map = await new PrismaProcessMapRepository(db as unknown as TransactionClient).persist(
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
      "00000000-0000-4000-8000-000000000004",
      processBuild(),
      null,
    );

    expect(map.id).toBe("00000000-0000-4000-8000-000000000010");
    expect(db.processMapNode.createMany).toHaveBeenCalledTimes(1);
    expect(db.processMapEdge.createMany).toHaveBeenCalledTimes(1);
    expect(db.processMapNode.createMany.mock.calls[0][0].data).toHaveLength(2);
    const nodeRows = db.processMapNode.createMany.mock.calls[0][0].data as Array<{
      id: string;
      nodeKey: string;
    }>;
    const edgeRows = db.processMapEdge.createMany.mock.calls[0][0].data as Array<{
      fromNodeId: string;
      toNodeId: string;
    }>;
    const byKey = new Map(nodeRows.map((node) => [node.nodeKey, node.id]));
    expect(edgeRows).toEqual([
      expect.objectContaining({
        fromNodeId: byKey.get("receive_invoice"),
        toNodeId: byKey.get("approve_invoice"),
      }),
    ]);
    expect(db.processMapFactUsage.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          knowledgeFactId: "00000000-0000-4000-8000-000000000101",
          usage: "consumed",
        }),
        expect.objectContaining({
          knowledgeFactId: "00000000-0000-4000-8000-000000000102",
          usage: "ignored",
        }),
      ]),
    });
  });
});

function processBuild(): ProcessBuild {
  return {
    pattern: {
      id: "00000000-0000-4000-8000-000000000020",
      code: "invoice_processing",
      version: 2,
      name: "Invoice processing",
      industryScope: [],
      requiredFacts: [],
      optionalFacts: [],
      graphTemplate: { nodes: [], edges: [] },
      validationRules: [],
    },
    nodes: [
      {
        key: "receive_invoice",
        type: "activity",
        name: "Receive invoice",
        description: "Invoice received",
        sequence: 1,
        knowledgeFactIds: ["00000000-0000-4000-8000-000000000101"],
      },
      {
        key: "approve_invoice",
        type: "decision",
        name: "Approve invoice",
        description: "Approval decision",
        sequence: 2,
        knowledgeFactIds: [],
      },
    ],
    edges: [{ from: "receive_invoice", to: "approve_invoice", type: "sequence" }],
    ownership: {
      ownerNodeId: null,
      departmentNodeId: null,
      participantNodeIds: [],
      systemNodeIds: [],
    },
    validations: [{ code: "ok", severity: "info", message: "Ready" }],
    consumedFacts: [
      {
        fact: { id: "00000000-0000-4000-8000-000000000101" },
        reason: "Supports the process step",
        weight: 1,
      },
    ],
    ignoredFacts: [
      {
        fact: { id: "00000000-0000-4000-8000-000000000102" },
        reason: "Unrelated to selected process",
      },
    ],
    selectionReasons: ["invoice evidence"],
    completeness: 90,
    confidence: 85,
    coverage: 80,
    ready: true,
  } as unknown as ProcessBuild;
}
