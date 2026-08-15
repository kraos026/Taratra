import type {
  CompanyActor,
  CompanyIntake,
  IntakeSession,
  IntakeSource,
} from "../domain/company-intake";

export interface CompanyIntakeRepository {
  saveIntake(intake: CompanyIntake): Promise<void>;
  getIntake(tenantId: string, companyId: string): Promise<CompanyIntake | null>;
  saveSource(source: IntakeSource): Promise<void>;
  listSources(tenantId: string, companyId: string): Promise<readonly IntakeSource[]>;
  saveActor(actor: CompanyActor): Promise<void>;
  listActors(tenantId: string, companyId: string): Promise<readonly CompanyActor[]>;
  saveSession(session: IntakeSession): Promise<void>;
  getSession(tenantId: string, companyId: string, sessionId: string): Promise<IntakeSession | null>;
}
