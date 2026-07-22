import { AuditOverview } from "@/modules/audits/presentation/audit-pages";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <AuditOverview id={(await params).id} />;
}
