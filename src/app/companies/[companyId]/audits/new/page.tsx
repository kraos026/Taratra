import { NewAudit } from "@/modules/audits/presentation/audit-pages";
export default async function Page({ params }: { params: Promise<{ companyId: string }> }) {
  return <NewAudit companyId={(await params).companyId} />;
}
