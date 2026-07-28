import type {
  GenerationCompilationInput,
  GenerationCompilationResult,
  GenerationCompiler,
} from "../domain/automation-generator-domain-services";

export class GenerationCompilationNotImplemented extends Error {
  readonly code = "GENERATION_COMPILATION_NOT_IMPLEMENTED";

  constructor() {
    super("Automation graph compilation is intentionally deferred to AG-2B");
    this.name = "GenerationCompilationNotImplemented";
  }
}

export class DefaultGenerationCompiler implements GenerationCompiler {
  compile(input: GenerationCompilationInput): GenerationCompilationResult {
    void input;
    throw new GenerationCompilationNotImplemented();
  }
}
