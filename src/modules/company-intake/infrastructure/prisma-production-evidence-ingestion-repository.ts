import type { Prisma } from "@/generated/prisma/client";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import type { EnterpriseEvidenceRecord } from "../../../brain-evaluation/convergence-adapters";
import type {
  ProductionEvidenceIngestionPort,
  StructuredEvidence,
} from "../application/production-evidence-ingestion";

export class PrismaProductionEvidenceIngestionRepository implements ProductionEvidenceIngestionPort {
  constructor(private readonly db: TransactionClient) {}

  async isVersionIngested(input: {
    tenantId: string;
    companyId: string;
    sourceId: string;
    sourceVersion: number;
  }): Promise<boolean> {
    const existing = await this.db.auditProductionEvidenceSourceRecord.findFirst({
      where: {
        organizationId: input.tenantId,
        companyId: input.companyId,
        sourceKey: input.sourceId,
        sourceVersion: input.sourceVersion,
      },
      select: { id: true },
    });
    return Boolean(existing);
  }

  async persistSource(input: {
    tenantId: string;
    companyId: string;
    sourceId: string;
    sourceVersion: number;
    sourceType: string;
    rawContent?: string;
    structured?: StructuredEvidence;
    origin: string;
    authorOrSystem?: string;
    receivedAt: Date;
    metadata: Readonly<Record<string, string>>;
  }): Promise<void> {
    const data = {
      sourceType: input.sourceType,
      origin: input.origin,
      authorOrSystem: input.authorOrSystem,
      rawContent: input.rawContent,
      structuredJson: input.structured ? json(input.structured) : undefined,
      metadataJson: json(input.metadata),
      receivedAt: input.receivedAt,
      ingestedAt: new Date(input.receivedAt),
    };
    await this.db.auditProductionEvidenceSourceRecord.upsert({
      where: {
        organizationId_companyId_sourceKey_sourceVersion: {
          organizationId: input.tenantId,
          companyId: input.companyId,
          sourceKey: input.sourceId,
          sourceVersion: input.sourceVersion,
        },
      },
      create: {
        organizationId: input.tenantId,
        companyId: input.companyId,
        sourceKey: input.sourceId,
        sourceVersion: input.sourceVersion,
        ...data,
      },
      update: data,
    });
  }

  async persistEvidence(records: readonly EnterpriseEvidenceRecord[]): Promise<void> {
    for (const record of records) {
      if (!record.tenantId || !record.companyId) {
        throw new Error("Evidence record scope is required");
      }
      const sourceKey = String(record.provenance.sourceId ?? "");
      const sourceVersion = Number(record.provenance.sourceVersion ?? 0);
      if (!sourceKey || !Number.isInteger(sourceVersion) || sourceVersion < 1) {
        throw new Error("Evidence record provenance must reference a production source version");
      }
      const source = await this.db.auditProductionEvidenceSourceRecord.findFirst({
        where: {
          organizationId: record.tenantId,
          companyId: record.companyId,
          sourceKey,
          sourceVersion,
        },
        select: { id: true },
      });
      if (!source) throw new Error("Production evidence source was not persisted");
      await this.db.auditProductionEvidenceRecord.upsert({
        where: {
          organizationId_sourceId_evidenceKey: {
            organizationId: record.tenantId,
            sourceId: source.id,
            evidenceKey: record.id,
          },
        },
        create: {
          organizationId: record.tenantId,
          companyId: record.companyId,
          sourceId: source.id,
          evidenceKey: record.id,
          content: record.content,
          structuredJson: record.structuredValue ? json(record.structuredValue) : undefined,
          provenanceJson: json(record.provenance),
          confidence: record.reliability,
        },
        update: {
          content: record.content,
          structuredJson: record.structuredValue ? json(record.structuredValue) : undefined,
          provenanceJson: json(record.provenance),
          confidence: record.reliability,
        },
      });
    }
  }
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
