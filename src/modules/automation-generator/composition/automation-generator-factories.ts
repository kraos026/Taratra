import {
  DeprecateAutomationGeneration,
  GenerateAutomationGraph,
  PublishAutomationGeneration,
  RebuildAutomationGeneration,
  RequestAutomationGeneration,
} from "../application/automation-generator-command-use-cases";
import {
  GetAutomationGeneration,
  GetAutomationGraph,
  GetGenerationExplanations,
  GetGenerationProvenance,
} from "../application/automation-generator-query-use-cases";
import { IdempotentCommandExecutor } from "../application/idempotent-command-executor";
import { AutomationGenerationPublisher } from "../domain/automation-generation";
import type { AutomationGeneratorProviders } from "./automation-generator-providers";

export interface AutomationGeneratorUseCases {
  readonly requestAutomationGeneration: RequestAutomationGeneration;
  readonly generateAutomationGraph: GenerateAutomationGraph;
  readonly rebuildAutomationGeneration: RebuildAutomationGeneration;
  readonly publishAutomationGeneration: PublishAutomationGeneration;
  readonly deprecateAutomationGeneration: DeprecateAutomationGeneration;
  readonly getAutomationGeneration: GetAutomationGeneration;
  readonly getAutomationGraph: GetAutomationGraph;
  readonly getGenerationProvenance: GetGenerationProvenance;
  readonly getGenerationExplanations: GetGenerationExplanations;
}

export function createAutomationGeneratorUseCases(
  providers: AutomationGeneratorProviders,
): AutomationGeneratorUseCases {
  const idempotency = new IdempotentCommandExecutor(
    providers.idempotencyStore,
    providers.contentHasher,
  );
  const command = {
    transaction: providers.transaction,
    repository: providers.repository,
    idempotency,
  };
  const compilation = {
    ...command,
    specificationReader: providers.specificationReader,
    ruleCatalog: providers.ruleCatalog,
    compiler: providers.compiler,
    clock: providers.clock,
  };
  const query = {
    transaction: providers.transaction,
    repository: providers.repository,
  };

  return Object.freeze({
    requestAutomationGeneration: new RequestAutomationGeneration({
      ...command,
      specificationReader: providers.specificationReader,
      idFactory: providers.idFactory,
      clock: providers.clock,
    }),
    generateAutomationGraph: new GenerateAutomationGraph(compilation),
    rebuildAutomationGeneration: new RebuildAutomationGeneration(compilation),
    publishAutomationGeneration: new PublishAutomationGeneration({
      ...command,
      clock: providers.clock,
      outbox: providers.outbox,
      publisher: new AutomationGenerationPublisher(),
    }),
    deprecateAutomationGeneration: new DeprecateAutomationGeneration({
      ...command,
      clock: providers.clock,
      outbox: providers.outbox,
    }),
    getAutomationGeneration: new GetAutomationGeneration(query),
    getAutomationGraph: new GetAutomationGraph(query),
    getGenerationProvenance: new GetGenerationProvenance(query),
    getGenerationExplanations: new GetGenerationExplanations(query),
  });
}
