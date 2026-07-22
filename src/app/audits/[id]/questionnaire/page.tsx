import { AuditQuestionnaire } from "@/modules/audits/presentation/audit-pages";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <AuditQuestionnaire id={(await params).id} />;
}
