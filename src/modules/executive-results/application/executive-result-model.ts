import type { AssistedAuditReadModel } from "@/modules/assisted-audit/application/assisted-audit-model";

export interface ExecutiveAuditResult {
  company: { id: string; name: string };
  complete: boolean;
  audit: AssistedAuditReadModel;
  overview: { processes: number; findings: number; opportunities: number; recommendations: number };
  process: { id: string; name: string } | null;
  findings: { id: string; title: string; description: string; severity: string; impact: string }[];
  opportunities: {
    id: string;
    title: string;
    problem: string;
    impact: number;
    readiness: number;
    confidence: number;
  }[];
  roi: {
    id: string;
    currency: string;
    evaluations: {
      id: string;
      title: string;
      annualBenefit: number | null;
      roi: number | null;
      roiSpecialValue: string | null;
      payback: number | null;
    }[];
  } | null;
  recommendations: {
    id: string;
    title: string;
    action: string;
    description: string;
    priority: string;
    phase: string;
    expectedRoi: number | null;
    roiSpecialValue: string | null;
    payback: number | null;
    confidence: number;
  }[];
  provenance: {
    processMapId: string;
    analysisId: string;
    automationOpportunitySnapshotId: string;
    roiId: string;
    recommendationPortfolioId: string;
  } | null;
}

export interface ExecutiveResultRepositoryPort {
  read(userId: string, companyId: string): Promise<ExecutiveAuditResult | null>;
}
