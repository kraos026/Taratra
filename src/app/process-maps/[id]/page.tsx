import { ProcessExplorer } from "@/modules/process-mapping/presentation/process-explorer";
export default async function ProcessMapPage({ params }: { params: Promise<{ id: string }> }) {
  return <ProcessExplorer id={(await params).id} />;
}
