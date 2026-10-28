import { notFound } from "next/navigation";
import { ConvexPilot } from "@/infrastructure/convex/pilot";
export const dynamic = "force-dynamic";
export default async function ConvexAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (process.env.NEXT_PUBLIC_OPTIVOS_CONVEX_PILOT !== "1" || !url) notFound();
  const { id } = await params;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) notFound();
  return <ConvexPilot url={url} auditId={id} />;
}
