import { Prisma } from "@/generated/prisma/client";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import type {
  DiscoveryKnowledgeInput,
  InterviewKnowledgeInput,
  KnowledgeProjection,
} from "../domain/knowledge-projection";

export class PrismaKnowledgeRepository {
  constructor(private readonly db: TransactionClient) {}

  context(userId: string) {
    return this.db.organizationMember.findFirst({
      where: { userId },
      select: { organizationId: true, role: true },
    });
  }

  async inputs(
    organizationId: string,
    companyId: string,
  ): Promise<{
    discovery: DiscoveryKnowledgeInput | null;
    interview: InterviewKnowledgeInput | null;
  }> {
    const discoverySession = await this.db.discoverySession.findFirst({
      where: { organizationId, companyId, status: "validated" },
      orderBy: { version: "desc" },
    });
    if (!discoverySession?.validatedAt) return { discovery: null, interview: null };
    const [profile, departments, roles, software, processes, interviewSession] = await Promise.all([
      this.db.companyProfile.findFirst({ where: { organizationId, companyId } }),
      this.db.department.findMany({ where: { organizationId, companyId } }),
      this.db.companyRole.findMany({ where: { organizationId, companyId } }),
      this.db.companySoftware.findMany({ where: { organizationId, companyId } }),
      this.db.businessProcess.findMany({ where: { organizationId, companyId } }),
      this.db.interviewSession.findFirst({
        where: { organizationId, companyId, status: "validated" },
        orderBy: { version: "desc" },
      }),
    ]);
    if (!profile) return { discovery: null, interview: null };
    const discovery: DiscoveryKnowledgeInput = {
      session: {
        id: discoverySession.id,
        version: discoverySession.version,
        validatedAt: discoverySession.validatedAt,
      },
      profile: {
        companyId,
        industry: profile.industry,
        countryCode: profile.countryCode,
        employeeCount: profile.employeeCount,
        businessModel: profile.businessModel,
        growthStage: profile.growthStage,
      },
      departments: departments.map((item) => ({
        id: item.id,
        name: item.name,
        headcount: item.headcount,
      })),
      roles: roles.map((item) => ({
        id: item.id,
        departmentId: item.departmentId,
        title: item.title,
        headcount: item.headcount,
      })),
      software: software.map((item) => ({
        id: item.id,
        name: item.customName ?? "Software",
        purpose: item.purpose,
        criticality: item.criticality,
      })),
      processes: processes.map((item) => ({
        id: item.id,
        name: item.name,
        frequency: item.frequency,
        manualHoursMonth: item.manualHoursMonth === null ? null : Number(item.manualHoursMonth),
      })),
    };
    if (!interviewSession?.validatedAt) return { discovery, interview: null };
    const answers = await this.db.interviewAnswer.findMany({
      where: { organizationId, interviewSessionId: interviewSession.id },
    });
    const questions = await this.db.interviewQuestion.findMany({
      where: { id: { in: answers.map((answer) => answer.questionId) } },
      select: { id: true, code: true, domain: true },
    });
    const questionById = new Map(questions.map((question) => [question.id, question]));
    const interview: InterviewKnowledgeInput = {
      session: {
        id: interviewSession.id,
        version: interviewSession.version,
        validatedAt: interviewSession.validatedAt,
      },
      answers: answers.map((answer) => {
        const question = questionById.get(answer.questionId);
        return {
          id: answer.id,
          code: question?.code ?? `unknown.${answer.questionId}`,
          domain: question?.domain ?? "unknown",
          value: answer.valueJson,
          confidence: answer.confidence,
        };
      }),
    };
    return { discovery, interview };
  }

  async persist(
    organizationId: string,
    companyId: string,
    userId: string,
    projection: KnowledgeProjection,
  ) {
    await this.db
      .$executeRaw`select pg_advisory_xact_lock(hashtextextended(${`${organizationId}:${companyId}:knowledge`}, 0))`;
    const latest = await this.db.knowledgeSnapshot.findFirst({
      where: { organizationId, companyId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const snapshot = await this.db.knowledgeSnapshot.create({
      data: {
        organizationId,
        companyId,
        createdBy: userId,
        version: (latest?.version ?? 0) + 1,
      },
    });
    const sourceIds = new Map<string, string>();
    for (const source of projection.sources) {
      const created = await this.db.knowledgeSource.create({
        data: {
          organizationId,
          snapshotId: snapshot.id,
          sourceType: source.type,
          sourceId: source.sourceId,
          sourceVersion: source.version,
          validatedAt: source.validatedAt,
        },
      });
      sourceIds.set(source.key, created.id);
    }
    const nodeIds = new Map<string, string>();
    for (const node of projection.nodes) {
      const created = await this.db.knowledgeNode.create({
        data: {
          organizationId,
          snapshotId: snapshot.id,
          nodeKey: node.key,
          nodeType: node.type,
          domain: node.domain,
          label: node.label,
          canonicalEntityType: node.canonicalEntityType,
          canonicalEntityId: node.canonicalEntityId,
          confidencePercentage: node.confidence,
        },
      });
      nodeIds.set(node.key, created.id);
    }
    for (const fact of projection.facts) {
      const created = await this.db.knowledgeFact.create({
        data: {
          organizationId,
          snapshotId: snapshot.id,
          nodeId: fact.nodeKey ? nodeIds.get(fact.nodeKey) : null,
          factKey: fact.key,
          domain: fact.domain,
          valueJson: fact.value as Prisma.InputJsonValue,
          valueType: fact.valueType,
          confidencePercentage: fact.confidence,
        },
      });
      await this.db.knowledgeEvidence.create({
        data: {
          organizationId,
          snapshotId: snapshot.id,
          factId: created.id,
          sourceId: sourceIds.get(fact.sourceKey)!,
          sourceRecordType: fact.sourceRecordType,
          sourceRecordId: fact.sourceRecordId,
          evidenceType: fact.evidenceType,
          confidencePercentage: fact.confidence,
        },
      });
    }
    if (projection.relationships.length)
      await this.db.knowledgeRelationship.createMany({
        data: projection.relationships.map((relationship) => ({
          organizationId,
          snapshotId: snapshot.id,
          fromNodeId: nodeIds.get(relationship.fromNodeKey)!,
          toNodeId: nodeIds.get(relationship.toNodeKey)!,
          relationshipType: relationship.type,
          confidencePercentage: relationship.confidence,
        })),
      });
    return this.db.knowledgeSnapshot.update({
      where: { id: snapshot.id, organizationId },
      data: { status: "ready", generatedAt: new Date() },
    });
  }
}
