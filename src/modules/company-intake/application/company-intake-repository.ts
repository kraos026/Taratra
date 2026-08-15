import type {
  CompanyActor,
  CompanyIntake,
  IntakeSession,
  IntakeSource,
} from "../domain/company-intake";

/**
 * Test-fixture port only. Production persistence is owned by the Companies,
 * Discovery, Interview and Knowledge repositories; this port must not be
 * wired into the application composition root.
 */
export interface TestCompanyIntakeRepository {
  saveIntake(intake: CompanyIntake): Promise<void>;
  getIntake(tenantId: string, companyId: string): Promise<CompanyIntake | null>;
  saveSource(source: IntakeSource): Promise<void>;
  listSources(tenantId: string, companyId: string): Promise<readonly IntakeSource[]>;
  saveActor(actor: CompanyActor): Promise<void>;
  listActors(tenantId: string, companyId: string): Promise<readonly CompanyActor[]>;
  saveSession(session: IntakeSession): Promise<void>;
  getSession(tenantId: string, companyId: string, sessionId: string): Promise<IntakeSession | null>;
}

/** @deprecated Use production repositories or TestCompanyIntakeRepository in fixtures. */
export type CompanyIntakeRepository = TestCompanyIntakeRepository;
