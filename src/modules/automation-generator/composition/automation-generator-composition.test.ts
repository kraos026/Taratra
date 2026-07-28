import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import type {
  ContentHasherPort,
  GenerationRuleCatalogPort,
} from "../application/automation-generator-application-ports";
import { ContentHash } from "../domain/automation-generator-value-objects";
import { DefaultGenerationCompiler } from "../infrastructure/default-generation-compiler";
import { DomainEventPublisher } from "../infrastructure/domain-event-publisher";
import { GenerationSpecificationReader } from "../infrastructure/generation-specification-reader";
import { PrismaAutomationGenerationRepository } from "../infrastructure/prisma-automation-generation-repository";
import { PrismaIdempotencyStore } from "../infrastructure/prisma-idempotency-store";
import { PrismaOutboxStore } from "../infrastructure/prisma-outbox-store";
import { PrismaTransactionManager } from "../infrastructure/prisma-transaction-manager";
import { SystemClock, UuidFactory } from "../infrastructure/system-adapters";
import { AutomationGeneratorModule } from "./automation-generator-module";
import { AUTOMATION_GENERATOR_PORTS } from "./automation-generator-providers";

const moduleDirectory = join(process.cwd(), "src", "modules", "automation-generator");

describe("Automation Generator composition root", () => {
  it("resolves every provider and use case", () => {
    const compositionRoot = createModule();

    for (const port of AUTOMATION_GENERATOR_PORTS)
      expect(compositionRoot.providers[port]).toBeDefined();
    expect(Object.values(compositionRoot.useCases)).toHaveLength(9);
    expect(Object.values(compositionRoot.useCases).every(Boolean)).toBe(true);
  });

  it("binds each port to exactly one expected implementation", () => {
    const providers = createModule().providers;

    expect(providers.repository).toBeInstanceOf(PrismaAutomationGenerationRepository);
    expect(providers.transaction).toBeInstanceOf(PrismaTransactionManager);
    expect(providers.clock).toBeInstanceOf(SystemClock);
    expect(providers.idFactory).toBeInstanceOf(UuidFactory);
    expect(providers.outbox).toBeInstanceOf(DomainEventPublisher);
    expect(providers.compiler).toBeInstanceOf(DefaultGenerationCompiler);
    expect(providers.specificationReader).toBeInstanceOf(GenerationSpecificationReader);
    expect(providers.idempotencyStore).toBeInstanceOf(PrismaIdempotencyStore);
    expect(providers.outboxStore).toBeInstanceOf(PrismaOutboxStore);
    expect(new Set(AUTOMATION_GENERATOR_PORTS).size).toBe(AUTOMATION_GENERATOR_PORTS.length);
  });

  it("contains no missing provider or duplicate port binding", () => {
    const providers = createModule().providers;
    const bindings = AUTOMATION_GENERATOR_PORTS.map((port) => [port, providers[port]] as const);

    expect(bindings).toHaveLength(10);
    expect(bindings.filter(([, implementation]) => implementation === undefined)).toEqual([]);
    expect(bindings.map(([port]) => port)).toEqual(AUTOMATION_GENERATOR_PORTS);
  });

  it("keeps dependencies one-way and contains no REST artifact", () => {
    const lowerLayers = ["domain", "application", "infrastructure"]
      .flatMap((layer) => files(join(moduleDirectory, layer)))
      .filter(sourceFile)
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    const composition = files(join(moduleDirectory, "composition"))
      .filter(sourceFile)
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    expect(lowerLayers).not.toMatch(/from\s+["'][^"']*composition/);
    expect(composition).not.toMatch(
      /@Controller|NextRequest|NextResponse|route\.ts|Swagger|OpenAPI|DTO/i,
    );
    expect(composition).not.toMatch(/from\s+["'][^"']*automation-generator-module["']/);
  });
});

function createModule(): AutomationGeneratorModule {
  const ruleCatalog: GenerationRuleCatalogPort = {
    getPublishedCompatibleCatalog: async () => null,
  };
  const contentHasher: ContentHasherPort = {
    fingerprint: () => ContentHash.create("a".repeat(64)),
  };
  return AutomationGeneratorModule.create({
    prisma: {} as PrismaClient,
    securityContext: { userId: () => "00000000-0000-4000-8000-000000000001" },
    ruleCatalog,
    contentHasher,
  });
}

function sourceFile(path: string): boolean {
  return path.endsWith(".ts") && !path.endsWith(".test.ts");
}

function files(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}
