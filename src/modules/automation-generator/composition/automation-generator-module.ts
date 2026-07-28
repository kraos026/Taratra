import {
  AutomationGeneratorInfrastructureModule,
  type AutomationGeneratorInfrastructureDependencies,
  type AutomationGeneratorInfrastructureProviders,
} from "./automation-generator-infrastructure-module";
import {
  createAutomationGeneratorUseCases,
  type AutomationGeneratorUseCases,
} from "./automation-generator-factories";

export class AutomationGeneratorModule {
  private constructor(
    readonly providers: AutomationGeneratorInfrastructureProviders,
    readonly useCases: AutomationGeneratorUseCases,
  ) {
    Object.freeze(this);
  }

  static create(
    dependencies: AutomationGeneratorInfrastructureDependencies,
  ): AutomationGeneratorModule {
    const providers = AutomationGeneratorInfrastructureModule.create(dependencies);
    return new AutomationGeneratorModule(providers, createAutomationGeneratorUseCases(providers));
  }
}
