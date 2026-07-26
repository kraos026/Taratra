import { AuditReportDashboard } from "@/modules/reports/presentation/audit-report-dashboard";
export default async function AuditReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AuditReportDashboard auditId={id} />;
}
