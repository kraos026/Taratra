import { ProcessMappingEngine } from "../domain/process-mapping-engine";
import type { PrismaProcessMapRepository } from "../infrastructure/prisma-process-map-repository";
import {
  ProcessMapConflictError,
  ProcessMapForbiddenError,
  ProcessMapNotFoundError,
  ProcessMapValidationError,
} from "./process-map-errors";

export class ProcessMapService {
  constructor(
    private readonly repo: PrismaProcessMapRepository,
    private readonly userId: string,
    private readonly engine = new ProcessMappingEngine(),
  ) {}
  private async context() {
    const c = await this.repo.context(this.userId);
    if (!c) throw new ProcessMapForbiddenError();
    return c;
  }
  private write(role: string) {
    if (role === "viewer") throw new ProcessMapForbiddenError();
  }
  async build(snapshotId: string) {
    const c = await this.context();
    this.write(c.role);
    const input = await this.repo.knowledge(c.organizationId, snapshotId);
    if (!input)
      throw new ProcessMapValidationError("A ready Enterprise Knowledge snapshot is required");
    const patterns = await this.repo.patterns(c.organizationId);
    const builds = this.engine.build(patterns, input.facts, input.nodes);
    if (!builds.length)
      throw new ProcessMapValidationError("No process pattern matched relevant knowledge");
    const results = [];
    for (const build of builds)
      results.push(
        await this.repo.persist(
          c.organizationId,
          input.snapshot.companyId,
          snapshotId,
          this.userId,
          build,
          null,
        ),
      );
    return results;
  }
  async rebuild(id: string, snapshotId: string, lockVersion: number) {
    const c = await this.context();
    this.write(c.role);
    const current = await this.repo.map(c.organizationId, id);
    if (!current) throw new ProcessMapNotFoundError();
    if (current.lockVersion !== lockVersion) throw new ProcessMapConflictError();
    const input = await this.repo.knowledge(c.organizationId, snapshotId);
    if (!input || input.snapshot.companyId !== current.companyId)
      throw new ProcessMapValidationError(
        "Ready knowledge snapshot must belong to the same company",
      );
    const pattern = (await this.repo.patterns(c.organizationId)).find(
      (p) => p.id === current.processPatternId,
    );
    if (!pattern) throw new ProcessMapValidationError("Published pattern version is unavailable");
    return this.repo.persist(
      c.organizationId,
      current.companyId,
      snapshotId,
      this.userId,
      this.engine.rebuild(pattern, input.facts, input.nodes),
      current.id,
    );
  }
  async get(id: string) {
    const c = await this.context();
    const map = await this.repo.detail(c.organizationId, id);
    if (!map) throw new ProcessMapNotFoundError();
    return map;
  }
  async list(
    companyId: string,
    q: { page: number; pageSize: number; status?: string; latestPublished?: boolean },
  ) {
    const c = await this.context();
    return this.repo.list(c.organizationId, companyId, q);
  }
  async validate(id: string, lockVersion: number) {
    const c = await this.context();
    this.write(c.role);
    const map = await this.repo.map(c.organizationId, id);
    if (!map) throw new ProcessMapNotFoundError();
    const validations = map.validationJson as { severity: string }[];
    if (validations.some((v) => v.severity === "error"))
      throw new ProcessMapValidationError("Blocking process validation errors remain");
    return this.repo.transition(c.organizationId, id, lockVersion, "validated");
  }
  async publish(id: string, lockVersion: number) {
    const c = await this.context();
    if (!["owner", "admin"].includes(c.role)) throw new ProcessMapForbiddenError();
    return this.repo.transition(c.organizationId, id, lockVersion, "published");
  }
}
