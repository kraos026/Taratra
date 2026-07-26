import { ProcessMapHistory } from "@/modules/process-mapping/presentation/process-explorer";
export default async function ProcessMapsPage({ params }: { params: Promise<{ id: string }> }) {
  return <ProcessMapHistory companyId={(await params).id} />;
}
