import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import type {
  ApplicationTransaction,
  AutomationGenerationRepositoryPort,
} from "../application/automation-generator-application-ports";
import {
  AutomationGeneration,
  type AutomationGenerationRehydration,
} from "../domain/automation-generation";
import { GenerationStatus } from "../domain/automation-generator-enums";
import { GenerationVersionConflict } from "../domain/automation-generator-errors";
import {
  CatalogVersion,
  ContentHash,
  GenerationId,
  GenerationLineageId,
  GenerationVersion,
  GeneratorVersion,
  GraphSchemaVersion,
  LockVersion,
  TenantId,
} from "../domain/automation-generator-value-objects";
import { PrismaTransactionRegistry } from "./prisma-transaction-manager";

const persistedGenerationSchema = z
  .object({
    tenantId: z.string().uuid(),
    generationId: z.string().uuid(),
    lineageId: z.string().uuid(),
    generationVersion: z.number().int().positive(),
    lockVersion: z.number().int().positive(),
    specification: z.object({
      id: z.string().min(1),
      tenantId: z.string().uuid(),
      lineageId: z.string().min(1),
      version: z.number().int().positive(),
      status: z.literal("PUBLISHED"),
      contentHash: z.string().regex(/^[0-9a-f]{64}$/),
    }),
    generatorVersion: z.string(),
    graphSchemaVersion: z.string(),
    ruleCatalogVersion: z.string(),
    status: z.nativeEnum(GenerationStatus),
    isLatestVersion: z.boolean(),
    graph: z.null(),
    provenance: z.array(z.never()),
    explanations: z.array(z.never()),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    generatedAt: z.null(),
    publishedAt: z.null(),
    deprecatedAt: z.null(),
  })
  .strict();

export class PrismaAutomationGenerationRepository implements AutomationGenerationRepositoryPort {
  constructor(private readonly transactions: PrismaTransactionRegistry) {}

  async findById(
    transaction: ApplicationTransaction,
    tenantId: TenantId,
    generationId: GenerationId,
  ): Promise<AutomationGeneration | null> {
    const record = await this.transactions
      .resolve(transaction)
      .automationGenerationRecord.findFirst({
        where: { id: generationId.value, organizationId: tenantId.value },
      });
    return record ? rehydrate(record.stateJson) : null;
  }

  async findLatestBySpecificationLineage(
    transaction: ApplicationTransaction,
    tenantId: TenantId,
    specificationLineageId: string,
  ): Promise<AutomationGeneration | null> {
    const record = await this.transactions
      .resolve(transaction)
      .automationGenerationRecord.findFirst({
        where: {
          organizationId: tenantId.value,
          specificationLineageId,
          isLatestVersion: true,
        },
        orderBy: { generationVersion: "desc" },
      });
    return record ? rehydrate(record.stateJson) : null;
  }

  async findActivePublishedByLineage(
    transaction: ApplicationTransaction,
    tenantId: TenantId,
    lineageId: GenerationLineageId,
    excludingGenerationId: GenerationId,
  ): Promise<AutomationGeneration | null> {
    const record = await this.transactions
      .resolve(transaction)
      .automationGenerationRecord.findFirst({
        where: {
          organizationId: tenantId.value,
          lineageId: lineageId.value,
          status: GenerationStatus.Published,
          id: { not: excludingGenerationId.value },
        },
        orderBy: { generationVersion: "desc" },
      });
    return record ? rehydrate(record.stateJson) : null;
  }

  async save(transaction: ApplicationTransaction, generation: AutomationGeneration): Promise<void> {
    const client = this.transactions.resolve(transaction);
    const snapshot = generation.snapshot();
    const stateJson = serialize(generation);
    const existing = await client.automationGenerationRecord.findUnique({
      where: { id: snapshot.generationId.value },
      select: { lockVersion: true },
    });
    const data = {
      organizationId: snapshot.tenantId.value,
      lineageId: snapshot.lineageId.value,
      generationVersion: snapshot.generationVersion.value,
      specificationSnapshotId: snapshot.specification.id,
      specificationLineageId: snapshot.specification.lineageId,
      status: snapshot.status,
      lockVersion: snapshot.lockVersion.value,
      isLatestVersion: snapshot.isLatestVersion,
      stateJson,
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
    };
    if (!existing) {
      await client.automationGenerationRecord.create({
        data: { id: snapshot.generationId.value, ...data },
      });
      return;
    }
    const updated = await client.automationGenerationRecord.updateMany({
      where: {
        id: snapshot.generationId.value,
        organizationId: snapshot.tenantId.value,
        lockVersion: snapshot.lockVersion.value - 1,
      },
      data,
    });
    if (updated.count !== 1) throw new GenerationVersionConflict();
  }
}

function serialize(generation: AutomationGeneration): Prisma.InputJsonValue {
  const snapshot = generation.snapshot();
  if (snapshot.graph !== null)
    throw new Error("Generated graph persistence is unavailable until compiler AG-2B");
  return {
    tenantId: snapshot.tenantId.value,
    generationId: snapshot.generationId.value,
    lineageId: snapshot.lineageId.value,
    generationVersion: snapshot.generationVersion.value,
    lockVersion: snapshot.lockVersion.value,
    specification: {
      id: snapshot.specification.id,
      tenantId: snapshot.specification.tenantId.value,
      lineageId: snapshot.specification.lineageId,
      version: snapshot.specification.version,
      status: snapshot.specification.status,
      contentHash: snapshot.specification.contentHash.value,
    },
    generatorVersion: snapshot.generatorVersion.value,
    graphSchemaVersion: snapshot.graphSchemaVersion.value,
    ruleCatalogVersion: snapshot.ruleCatalogVersion.value,
    status: snapshot.status,
    isLatestVersion: snapshot.isLatestVersion,
    graph: null,
    provenance: [],
    explanations: [],
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    generatedAt: null,
    publishedAt: null,
    deprecatedAt: null,
  };
}

function rehydrate(value: Prisma.JsonValue): AutomationGeneration {
  const state = persistedGenerationSchema.parse(value);
  const rehydration: AutomationGenerationRehydration = {
    tenantId: TenantId.create(state.tenantId),
    generationId: GenerationId.create(state.generationId),
    lineageId: GenerationLineageId.create(state.lineageId),
    generationVersion: GenerationVersion.create(state.generationVersion),
    lockVersion: LockVersion.create(state.lockVersion),
    specification: {
      id: state.specification.id,
      tenantId: TenantId.create(state.specification.tenantId),
      lineageId: state.specification.lineageId,
      version: state.specification.version,
      status: state.specification.status,
      contentHash: ContentHash.create(state.specification.contentHash),
    },
    generatorVersion: GeneratorVersion.create(state.generatorVersion),
    graphSchemaVersion: GraphSchemaVersion.create(state.graphSchemaVersion),
    ruleCatalogVersion: CatalogVersion.create(state.ruleCatalogVersion),
    status: state.status,
    isLatestVersion: state.isLatestVersion,
    graph: null,
    provenance: [],
    explanations: [],
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    generatedAt: null,
    publishedAt: null,
    deprecatedAt: null,
  };
  return AutomationGeneration.rehydrate(rehydration);
}
