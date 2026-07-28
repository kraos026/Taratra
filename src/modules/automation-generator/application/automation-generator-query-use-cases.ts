import type {
  AutomationGeneration,
  AutomationGenerationSnapshot,
} from "../domain/automation-generation";
import type { CanonicalAutomationGraph } from "../domain/canonical-automation-graph";
import type { GenerationExplanation, GenerationProvenance } from "../domain/generation-provenance";
import {
  AutomationGenerationNotFound,
  AutomationGraphNotGenerated,
} from "./automation-generator-application-errors";
import type {
  ApplicationTransaction,
  AutomationGenerationRepositoryPort,
  TransactionPort,
} from "./automation-generator-application-ports";
import {
  GetAutomationGenerationQuery,
  GetAutomationGraphQuery,
  GetGenerationExplanationsQuery,
  GetGenerationProvenanceQuery,
} from "./automation-generator-queries";

interface QueryDependencies {
  readonly transaction: TransactionPort;
  readonly repository: AutomationGenerationRepositoryPort;
}

export class GetAutomationGeneration {
  constructor(private readonly dependencies: QueryDependencies) {}

  execute(query: GetAutomationGenerationQuery): Promise<Readonly<AutomationGenerationSnapshot>> {
    return this.dependencies.transaction.execute(async (transaction) => {
      const generation = await requiredGeneration(this.dependencies.repository, transaction, query);
      return generation.snapshot();
    });
  }
}

export class GetAutomationGraph {
  constructor(private readonly dependencies: QueryDependencies) {}

  execute(query: GetAutomationGraphQuery): Promise<CanonicalAutomationGraph> {
    return this.dependencies.transaction.execute(async (transaction) => {
      const generation = await requiredGeneration(this.dependencies.repository, transaction, query);
      const graph = generation.snapshot().graph;
      if (!graph) throw new AutomationGraphNotGenerated();
      return graph;
    });
  }
}

export class GetGenerationProvenance {
  constructor(private readonly dependencies: QueryDependencies) {}

  execute(query: GetGenerationProvenanceQuery): Promise<readonly GenerationProvenance[]> {
    return this.dependencies.transaction.execute(async (transaction) => {
      const generation = await requiredGeneration(this.dependencies.repository, transaction, query);
      return generation.snapshot().provenance;
    });
  }
}

export class GetGenerationExplanations {
  constructor(private readonly dependencies: QueryDependencies) {}

  execute(query: GetGenerationExplanationsQuery): Promise<readonly GenerationExplanation[]> {
    return this.dependencies.transaction.execute(async (transaction) => {
      const generation = await requiredGeneration(this.dependencies.repository, transaction, query);
      return generation.snapshot().explanations;
    });
  }
}

async function requiredGeneration(
  repository: AutomationGenerationRepositoryPort,
  transaction: ApplicationTransaction,
  query:
    | GetAutomationGenerationQuery
    | GetAutomationGraphQuery
    | GetGenerationProvenanceQuery
    | GetGenerationExplanationsQuery,
): Promise<AutomationGeneration> {
  const generation = await repository.findById(transaction, query.tenantId, query.generationId);
  if (!generation) throw new AutomationGenerationNotFound();
  return generation;
}
