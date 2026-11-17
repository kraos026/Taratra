import { notFound } from "next/navigation";
import { ConvexPilot } from "@/infrastructure/convex/pilot";

export const dynamic = "force-dynamic";
export default function ConvexPilotPage() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (process.env.NEXT_PUBLIC_OPTIVOS_CONVEX_PILOT !== "1" || !url) notFound();
  return <ConvexPilot url={url} />;
}
