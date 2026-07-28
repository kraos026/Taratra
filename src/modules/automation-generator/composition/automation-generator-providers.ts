import type {
  AutomationGenerationRepositoryPort,
  AutomationSpecificationReaderPort,
  ClockPort,
  ContentHasherPort,
  DeterministicIdFactory,
  DomainEventOutboxPort,
  GenerationRuleCatalogPort,
  IdempotencyStorePort,
  TransactionPort,
} from "../application/automation-generator-application-ports";
import type { GenerationCompiler } from "../domain/automation-generator-domain-services";

export const AUTOMATION_GENERATOR_PORTS = Object.freeze([
  "repository",
  "transaction",
  "clock",
  "idFactory",
  "outbox",
  "compiler",
  "specificationReader",
  "idempotencyStore",
  "ruleCatalog",
  "contentHasher",
] as const);

export type AutomationGeneratorPortName = (typeof AUTOMATION_GENERATOR_PORTS)[number];

export interface AutomationGeneratorProviders {
  readonly repository: AutomationGenerationRepositoryPort;
  readonly transaction: TransactionPort;
  readonly clock: ClockPort;
  readonly idFactory: DeterministicIdFactory;
  readonly outbox: DomainEventOutboxPort;
  readonly compiler: GenerationCompiler;
  readonly specificationReader: AutomationSpecificationReaderPort;
  readonly idempotencyStore: IdempotencyStorePort;
  readonly ruleCatalog: GenerationRuleCatalogPort;
  readonly contentHasher: ContentHasherPort;
}

export function assertCompleteProviders(
  providers: AutomationGeneratorProviders,
): AutomationGeneratorProviders {
  for (const port of AUTOMATION_GENERATOR_PORTS) {
    if (!providers[port]) throw new Error(`Automation Generator provider is missing: ${port}`);
  }
  return Object.freeze({ ...providers });
}
