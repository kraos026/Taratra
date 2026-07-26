import { Prisma } from "@/generated/prisma/client";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import type { ProcessBuild, ProcessPatternInput } from "../domain/process-mapping-engine";
import { ProcessMapConflictError } from "../application/process-map-errors";

export class PrismaProcessMapRepository {
  constructor(private readonly db: TransactionClient) {}
  context(userId: string) {
    return this.db.organizationMember.findFirst({
      where: { userId },
      select: { organizationId: true, role: true },
    });
  }
  async knowledge(organizationId: string, snapshotId: string) {
    const snapshot = await this.db.knowledgeSnapshot.findFirst({
      where: { id: snapshotId, organizationId, status: "ready" },
    });
    if (!snapshot) return null;
    const [facts, nodes] = await Promise.all([
      this.db.knowledgeFact.findMany({ where: { organizationId, snapshotId } }),
      this.db.knowledgeNode.findMany({ where: { organizationId, snapshotId } }),
    ]);
    return {
      snapshot,
      facts: facts.map((f) => ({
        id: f.id,
        key: f.factKey,
        domain: f.domain,
        value: f.valueJson,
        confidence: Number(f.confidencePercentage),
      })),
      nodes: nodes.map((n) => ({
        id: n.id,
        key: n.nodeKey,
        type: n.nodeType,
        domain: n.domain,
        label: n.label,
        confidence: Number(n.confidencePercentage),
      })),
    };
  }
  async patterns(organizationId: string): Promise<ProcessPatternInput[]> {
    const rows = await this.db.processPattern.findMany({
      where: { status: "published", OR: [{ organizationId: null }, { organizationId }] },
      orderBy: [{ code: "asc" }, { version: "desc" }],
    });
    const latest = new Map<string, (typeof rows)[number]>();
    for (const row of rows) if (!latest.has(row.code)) latest.set(row.code, row);
    return [...latest.values()].map((row) => ({
      id: row.id,
      code: row.code,
      version: row.version,
      name: row.name,
      industryScope: row.industryScope as string[],
      requiredFacts: row.requiredFacts as unknown as ProcessPatternInput["requiredFacts"],
      optionalFacts: row.optionalFacts as unknown as ProcessPatternInput["optionalFacts"],
      graphTemplate: row.graphTemplate as unknown as ProcessPatternInput["graphTemplate"],
      validationRules: row.validationRules as unknown as ProcessPatternInput["validationRules"],
    }));
  }
  map(organizationId: string, id: string) {
    return this.db.processMap.findFirst({ where: { organizationId, id } });
  }
  async detail(organizationId: string, id: string) {
    const map = await this.db.processMap.findFirst({ where: { organizationId, id } });
    if (!map) return null;
    const [nodes, edges, ownership, validations, factUsage] = await Promise.all([
      this.db.processMapNode.findMany({
        where: { organizationId, processMapId: id },
        orderBy: { sequence: "asc" },
      }),
      this.db.processMapEdge.findMany({ where: { organizationId, processMapId: id } }),
      this.db.processMapOwnership.findFirst({ where: { organizationId, processMapId: id } }),
      this.db.processMapValidation.findMany({ where: { organizationId, processMapId: id } }),
      this.db.processMapFactUsage.findMany({ where: { organizationId, processMapId: id } }),
    ]);
    return { map, nodes, edges, ownership, validations, factUsage };
  }
  async list(
    organizationId: string,
    companyId: string,
    q: { page: number; pageSize: number; status?: string; latestPublished?: boolean },
  ) {
    const where = {
      organizationId,
      companyId,
      ...(q.status ? { status: q.status as "draft" } : {}),
      ...(q.latestPublished ? { status: "published" as const } : {}),
    };
    const [items, total] = await Promise.all([
      this.db.processMap.findMany({
        where,
        orderBy: { versionNumber: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.latestPublished ? 1 : q.pageSize,
      }),
      this.db.processMap.count({ where }),
    ]);
    return {
      items,
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize),
    };
  }
  async persist(
    organizationId: string,
    companyId: string,
    snapshotId: string,
    userId: string,
    build: ProcessBuild,
    previousVersionId: string | null,
  ) {
    await this.db
      .$executeRaw`select pg_advisory_xact_lock(hashtextextended(${`${organizationId}:${companyId}:${build.pattern.id}:process-map`},0))`;
    const latest = await this.db.processMap.findFirst({
      where: { organizationId, companyId, processPatternId: build.pattern.id },
      orderBy: { versionNumber: "desc" },
    });
    const map = await this.db.processMap.create({
      data: {
        organizationId,
        companyId,
        knowledgeSnapshotId: snapshotId,
        processPatternId: build.pattern.id,
        processPatternVersion: build.pattern.version,
        previousVersionId,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        name: build.pattern.name,
        graphJson: { nodes: build.nodes, edges: build.edges } as Prisma.InputJsonValue,
        validationJson: build.validations as unknown as Prisma.InputJsonValue,
        provenanceJson: {
          selectionReasons: build.selectionReasons,
          patternCode: build.pattern.code,
          patternVersion: build.pattern.version,
        } as Prisma.InputJsonValue,
        completenessPercentage: build.completeness,
        confidencePercentage: build.confidence,
        coveragePercentage: build.coverage,
        readyForBusinessIntelligence: build.ready,
        createdBy: userId,
      },
    });
    const ids = new Map<string, string>();
    for (const node of build.nodes) {
      const created = await this.db.processMapNode.create({
        data: {
          organizationId,
          processMapId: map.id,
          nodeKey: node.key,
          nodeType: node.type,
          name: node.name,
          description: node.description,
          sequence: node.sequence,
        },
      });
      ids.set(node.key, created.id);
    }
    if (build.edges.length)
      await this.db.processMapEdge.createMany({
        data: build.edges.map((edge) => ({
          organizationId,
          processMapId: map.id,
          fromNodeId: ids.get(edge.from)!,
          toNodeId: ids.get(edge.to)!,
          edgeType: edge.type,
        })),
      });
    await this.db.processMapOwnership.create({
      data: {
        organizationId,
        processMapId: map.id,
        ownerKnowledgeNodeId: build.ownership.ownerNodeId,
        departmentKnowledgeNodeId: build.ownership.departmentNodeId,
        participantKnowledgeNodeIds: build.ownership.participantNodeIds,
        supportingSystemNodeIds: build.ownership.systemNodeIds,
      },
    });
    if (build.validations.length)
      await this.db.processMapValidation.createMany({
        data: build.validations.map((v) => ({
          organizationId,
          processMapId: map.id,
          code: v.code,
          severity: v.severity,
          message: v.message,
          nodeKey: v.nodeKey,
        })),
      });
    const usage = [
      ...build.consumedFacts.map((x) => ({
        organizationId,
        processMapId: map.id,
        knowledgeFactId: x.fact.id,
        usage: "consumed",
        reason: x.reason,
        importanceWeight: x.weight,
      })),
      ...build.ignoredFacts.map((x) => ({
        organizationId,
        processMapId: map.id,
        knowledgeFactId: x.fact.id,
        usage: "ignored",
        reason: x.reason,
        importanceWeight: 0,
      })),
    ];
    if (usage.length) await this.db.processMapFactUsage.createMany({ data: usage });
    return map;
  }
  async transition(
    organizationId: string,
    id: string,
    lockVersion: number,
    status: "validated" | "published",
  ) {
    const changed = await this.db.processMap.updateMany({
      where: {
        organizationId,
        id,
        lockVersion,
        status: status === "validated" ? "draft" : "validated",
      },
      data: {
        status,
        lockVersion: { increment: 1 },
        ...(status === "validated" ? { validatedAt: new Date() } : { publishedAt: new Date() }),
      },
    });
    if (changed.count !== 1) throw new ProcessMapConflictError();
    return this.map(organizationId, id);
  }
}
