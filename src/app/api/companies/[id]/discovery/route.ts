import { withDiscoveryService } from "@/modules/discovery/presentation/discovery-api";
import { apiSuccess } from "@/shared/presentation/api-response";
export async function POST(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withDiscoveryService((s) => s.start(id).then((v) => apiSuccess(v, 201)));
}
export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withDiscoveryService((s) => s.companySession(id).then(apiSuccess));
}
