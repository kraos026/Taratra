import type { ExecutiveResultRepositoryPort } from "./executive-result-model";
import { safeExecutiveOutput } from "./executive-output";

export class ExecutiveResultService {
  constructor(
    private readonly repository: ExecutiveResultRepositoryPort,
    private readonly userId: string,
  ) {}
  async get(companyId: string) {
    const result = await this.repository.read(this.userId, companyId);
    return result ? safeExecutiveOutput(result) : null;
  }
}
