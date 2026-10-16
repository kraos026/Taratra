import { InteractiveDashboard } from "@/components/dashboard/interactive-dashboard";
import { redirect } from "next/navigation";
import { agentLabEnabled } from "@/modules/agent-workspace/application/agent-workspace-policy";

export default async function Home({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (agentLabEnabled() && (await searchParams).view !== "audit")
    redirect("/atelier-ia/entreprises");
  return <InteractiveDashboard />;
}
