import type { PrismaDiscoveryRepository } from "../infrastructure/prisma-discovery-repository";
import type { DiscoveryPayload } from "./discovery-schemas";
import {
  DiscoveryForbiddenError,
  DiscoveryNotFoundError,
  DiscoveryValidationError,
} from "../domain/discovery-errors";
export class DiscoveryService {
  constructor(
    private readonly repo: PrismaDiscoveryRepository,
    private readonly userId: string,
  ) {}
  private async context() {
    const c = await this.repo.context(this.userId);
    if (!c) throw new DiscoveryForbiddenError();
    return c;
  }
  private editor(role: string) {
    if (role === "viewer") throw new DiscoveryForbiddenError();
  }
  async start(companyId: string) {
    const c = await this.context();
    this.editor(c.role);
    if (!(await this.repo.company(c.organizationId, companyId))) throw new DiscoveryNotFoundError();
    const existing = await this.repo.latest(c.organizationId, companyId);
    if (existing && ["draft", "in_progress", "completed"].includes(existing.status))
      return existing;
    return this.repo.create(c.organizationId, companyId, this.userId, (existing?.version ?? 0) + 1);
  }
  async companySession(companyId: string) {
    const c = await this.context();
    if (!(await this.repo.company(c.organizationId, companyId))) throw new DiscoveryNotFoundError();
    const value = await this.repo.latest(c.organizationId, companyId);
    if (!value) throw new DiscoveryNotFoundError();
    return value;
  }
  async get(id: string) {
    const c = await this.context();
    const value = await this.repo.session(c.organizationId, id);
    if (!value) throw new DiscoveryNotFoundError();
    return value;
  }
  async autosave(id: string, lockVersion: number, payload: DiscoveryPayload) {
    const c = await this.context();
    this.editor(c.role);
    if (!(await this.repo.session(c.organizationId, id))) throw new DiscoveryNotFoundError();
    return this.repo.save(c.organizationId, id, this.userId, lockVersion, payload);
  }
  async validate(id: string) {
    const c = await this.context();
    this.editor(c.role);
    const session = await this.repo.session(c.organizationId, id);
    if (!session) throw new DiscoveryNotFoundError();
    const steps = new Set(session.answers.map((x) => x.step));
    for (const required of [
      "company",
      "business",
      "organization",
      "software",
      "processes",
      "review",
    ] as const)
      if (!steps.has(required)) throw new DiscoveryValidationError(`Missing ${required} step`);
    if (session.status !== "completed") throw new DiscoveryValidationError();
    return this.repo.validate(c.organizationId, id, this.userId);
  }
}
