export type AssistedAuditRole = "owner" | "admin" | "consultant" | "viewer";

export interface AssistedAuditRecord {
  id: string;
  version: number;
  status: string;
  lockVersion?: number;
  lineageKey?: string;
}

export interface AssistedAuditState {
  company: { id: string; name: string };
  role: AssistedAuditRole;
  discovery: AssistedAuditRecord | null;
  interview: AssistedAuditRecord | null;
  knowledge: AssistedAuditRecord | null;
  processMaps: AssistedAuditRecord[];
  selectedProcessMapId: string | null;
  analysis: AssistedAuditRecord | null;
  aiOpportunities: AssistedAuditRecord | null;
  automationOpportunities: AssistedAuditRecord | null;
  roi: AssistedAuditRecord | null;
  recommendations: AssistedAuditRecord | null;
}

export interface AssistedAuditRepositoryPort {
  read(userId: string, companyId: string): Promise<AssistedAuditState | null>;
}
