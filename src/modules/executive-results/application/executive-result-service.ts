import type { ExecutiveResultRepositoryPort } from "./executive-result-model";

export class ExecutiveResultService {
  constructor(
    private readonly repository: ExecutiveResultRepositoryPort,
    private readonly userId: string,
  ) {}
  get(companyId: string) {
    return this.repository.read(this.userId, companyId);
  }
}
