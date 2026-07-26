import { DiscoveryWizard } from "@/modules/discovery/presentation/discovery-wizard";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <DiscoveryWizard companyId={(await params).id} />;
}
