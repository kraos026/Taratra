import type { CompanyIntakeRepository } from "../application/company-intake-repository";
import type {
  CompanyActor,
  CompanyIntake,
  IntakeSession,
  IntakeSource,
} from "../domain/company-intake";

export class InMemoryCompanyIntakeRepository implements CompanyIntakeRepository {
  private readonly intakes = new Map<string, CompanyIntake>();
  private readonly sources = new Map<string, IntakeSource>();
  private readonly actors = new Map<string, CompanyActor>();
  private readonly sessions = new Map<string, IntakeSession>();

  private companyKey(tenantId: string, companyId: string): string {
    return `${tenantId}:${companyId}`;
  }

  async saveIntake(intake: CompanyIntake): Promise<void> {
    this.intakes.set(this.companyKey(intake.tenantId, intake.companyId), intake);
  }

  async getIntake(tenantId: string, companyId: string): Promise<CompanyIntake | null> {
    return this.intakes.get(this.companyKey(tenantId, companyId)) ?? null;
  }

  async saveSource(source: IntakeSource): Promise<void> {
    this.sources.set(`${source.tenantId}:${source.companyId}:${source.sourceId}`, source);
  }

  async listSources(tenantId: string, companyId: string): Promise<readonly IntakeSource[]> {
    return Object.freeze(
      [...this.sources.values()].filter(
        (source) => source.tenantId === tenantId && source.companyId === companyId,
      ),
    );
  }

  async saveActor(actor: CompanyActor): Promise<void> {
    this.actors.set(`${actor.tenantId}:${actor.companyId}:${actor.actorId}`, actor);
  }

  async listActors(tenantId: string, companyId: string): Promise<readonly CompanyActor[]> {
    return Object.freeze(
      [...this.actors.values()].filter(
        (actor) => actor.tenantId === tenantId && actor.companyId === companyId,
      ),
    );
  }

  async saveSession(session: IntakeSession): Promise<void> {
    this.sessions.set(`${session.tenantId}:${session.companyId}:${session.sessionId}`, session);
  }

  async getSession(
    tenantId: string,
    companyId: string,
    sessionId: string,
  ): Promise<IntakeSession | null> {
    return this.sessions.get(`${tenantId}:${companyId}:${sessionId}`) ?? null;
  }
}
