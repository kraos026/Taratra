import { RoiAssumptionsForm } from "@/modules/roi-evaluations/presentation/roi-assumptions-form";

export default async function RoiAssumptionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; opportunityId: string }>;
  searchParams: Promise<{ roiId?: string }>;
}) {
  const [{ id, opportunityId }, { roiId }] = await Promise.all([params, searchParams]);
  return <RoiAssumptionsForm companyId={id} opportunityId={opportunityId} initialRoiId={roiId} />;
}
