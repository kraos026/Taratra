import { AutomationAuditHub } from "@/modules/assisted-audit/presentation/automation-audit-hub";

export default async function AutomationAuditPage({ params }: { params: Promise<{ id: string }> }) {
  return <AutomationAuditHub companyId={(await params).id} />;
}
