import { describe, expect, it } from "vitest";
import {
  AutomationGenerationNotFound,
  AutomationGraphNotGenerated,
} from "./automation-generator-application-errors";
import {
  GetAutomationGeneration,
  GetAutomationGraph,
  GetGenerationExplanations,
  GetGenerationProvenance,
} from "./automation-generator-query-use-cases";
import {
  GetAutomationGenerationQuery,
  GetAutomationGraphQuery,
  GetGenerationExplanationsQuery,
  GetGenerationProvenanceQuery,
} from "./automation-generator-queries";
import {
  dependencies,
  generatedGeneration,
} from "./automation-generator-application-test-fixtures";
import { requestInput } from "../domain/automation-generator-test-fixtures";
import { AutomationGeneration } from "../domain/automation-generation";

describe("Automation Generator query use cases", () => {
  it("returns the Automation Generation read model through its repository port", async () => {
    const deps = dependencies();
    deps.repository.generation = generatedGeneration();
    const result = await new GetAutomationGeneration(deps).execute(
      new GetAutomationGenerationQuery(requestInput().tenantId, requestInput().generationId),
    );
    expect(result.generationId.equals(requestInput().generationId)).toBe(true);
    expect(deps.transaction.committed).toBe(1);
  });

  it("returns the canonical graph", async () => {
    const deps = dependencies();
    deps.repository.generation = generatedGeneration();
    const graph = await new GetAutomationGraph(deps).execute(
      new GetAutomationGraphQuery(requestInput().tenantId, requestInput().generationId),
    );
    expect(graph.nodes).toHaveLength(1);
  });

  it("rejects a graph query before generation", async () => {
    const deps = dependencies();
    deps.repository.generation = AutomationGeneration.request(requestInput());
    await expect(
      new GetAutomationGraph(deps).execute(
        new GetAutomationGraphQuery(requestInput().tenantId, requestInput().generationId),
      ),
    ).rejects.toBeInstanceOf(AutomationGraphNotGenerated);
  });

  it("returns provenance and explanations independently", async () => {
    const deps = dependencies();
    deps.repository.generation = generatedGeneration();
    const provenance = await new GetGenerationProvenance(deps).execute(
      new GetGenerationProvenanceQuery(requestInput().tenantId, requestInput().generationId),
    );
    const explanations = await new GetGenerationExplanations(deps).execute(
      new GetGenerationExplanationsQuery(requestInput().tenantId, requestInput().generationId),
    );
    expect(provenance).toHaveLength(1);
    expect(explanations).toHaveLength(1);
  });

  it("returns not found for every query without leaking another tenant", async () => {
    const deps = dependencies();
    await expect(
      new GetAutomationGeneration(deps).execute(
        new GetAutomationGenerationQuery(requestInput().tenantId, requestInput().generationId),
      ),
    ).rejects.toBeInstanceOf(AutomationGenerationNotFound);
  });
});
