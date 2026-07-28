import { z } from "zod";
import type {
  ApplicationTransaction,
  AutomationSpecificationReaderPort,
} from "../application/automation-generator-application-ports";
import type { PublishedAutomationSpecificationSnapshot } from "../domain/automation-generator-domain-services";
import { ContentHash, TenantId } from "../domain/automation-generator-value-objects";
import { PrismaTransactionRegistry } from "./prisma-transaction-manager";

const catalogVersionsSchema = z
  .object({
    contentHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
  })
  .passthrough();
const elementDefinitionSchema = z.record(z.string(), z.unknown());

export class GenerationSpecificationReader implements AutomationSpecificationReaderPort {
  constructor(private readonly transactions: PrismaTransactionRegistry) {}

  async readPublishedSnapshot(
    transaction: ApplicationTransaction,
    tenantId: TenantId,
    snapshotId: string,
  ): Promise<PublishedAutomationSpecificationSnapshot | null> {
    const specification = await this.transactions
      .resolve(transaction)
      .automationSpecification.findFirst({
        where: { id: snapshotId, organizationId: tenantId.value, status: "published" },
        include: { elements: { orderBy: [{ displayOrder: "asc" }, { localId: "asc" }] } },
      });
    if (!specification) return null;
    const metadata = catalogVersionsSchema.parse(specification.catalogVersionsJson);
    const contentHash = metadata.contentHash ?? specification.sourceFingerprint;
    return Object.freeze({
      id: specification.id,
      tenantId: specification.organizationId,
      lineageId: specification.solutionBlueprintId,
      version: specification.versionNumber,
      status: "PUBLISHED",
      contentHash: ContentHash.create(contentHash),
      elements: Object.freeze(
        specification.elements.map((element) => {
          const definition = elementDefinitionSchema.parse(element.definitionJson);
          const capabilities = z.array(z.string()).parse(definition.capabilityCodes ?? []);
          return Object.freeze({
            id: element.localId,
            type: element.elementType,
            capabilityCodes: Object.freeze([...new Set(capabilities)].sort()),
            definition: Object.freeze(definition),
          });
        }),
      ),
    });
  }
}
