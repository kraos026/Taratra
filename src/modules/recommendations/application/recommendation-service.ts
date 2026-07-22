import { randomUUID } from "node:crypto";
import { RecommendationEngine } from "./recommendation-engine";
import type { PrismaRecommendationRepository } from "../infrastructure/prisma-recommendation-repository";
export class RecommendationService {
  constructor(
    private readonly repo: PrismaRecommendationRepository,
    private readonly userId: string,
    private readonly engine = new RecommendationEngine(),
  ) {}
  private async context() {
    const c = await this.repo.context(this.userId);
    if (!c) throw new Error("FORBIDDEN");
    return c;
  }
  async generate(auditId: string, profileId: string) {
    const c = await this.context();
    if (c.role === "viewer") throw new Error("FORBIDDEN");
    if (!(await this.repo.audit(c.organizationId, auditId))) throw new Error("NOT_FOUND");
    const profile = await this.repo.profile(c.organizationId, profileId);
    if (!profile) throw new Error("NOT_FOUND");
    const matches = await this.repo.candidates(c.organizationId, auditId);
    const unique = new Map<string, Parameters<RecommendationEngine["evaluate"]>[0][number]>();
    let evaluationId: string = randomUUID();
    for (const match of matches) {
      evaluationId = match.evaluationId;
      for (const link of match.rule.recommendations) {
        const r = link.recommendation;
        if (!r.active || !r.impact) continue;
        const current = unique.get(r.id);
        const candidate = {
          id: r.id,
          code: r.code,
          difficulty: r.implementationDifficulty,
          hoursMonth: Number(r.impact.estimatedHoursPerMonth),
          implementationCost: Number(r.impact.estimatedCost),
          additionalAnnualSavings: Number(r.impact.estimatedSavings),
          rulePriority: match.rule.priority,
        };
        if (!current || candidate.rulePriority < current.rulePriority) unique.set(r.id, candidate);
      }
    }
    const result = this.engine.evaluate([...unique.values()], Number(profile.hourlyCost));
    await this.repo.store(c.organizationId, auditId, evaluationId, result);
    return { profile, result };
  }
  async results(auditId: string) {
    const c = await this.context();
    if (!(await this.repo.audit(c.organizationId, auditId))) throw new Error("NOT_FOUND");
    return this.repo.results(c.organizationId, auditId);
  }
  async profiles() {
    const c = await this.context();
    return this.repo.profiles(c.organizationId);
  }
  async createProfile(input: Parameters<PrismaRecommendationRepository["createProfile"]>[1]) {
    const c = await this.context();
    if (c.role !== "owner" && c.role !== "admin") throw new Error("FORBIDDEN");
    return this.repo.createProfile(c.organizationId, input);
  }
  async updateProfile(id: string, input: Record<string, unknown>) {
    const c = await this.context();
    if (c.role !== "owner" && c.role !== "admin") throw new Error("FORBIDDEN");
    const profile = await this.repo.profile(c.organizationId, id);
    if (!profile || profile.organizationId !== c.organizationId) throw new Error("NOT_FOUND");
    return this.repo.updateProfile(c.organizationId, id, input);
  }
}
