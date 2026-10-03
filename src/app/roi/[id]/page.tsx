import { notFound } from "next/navigation";
import { CompanyShell } from "@/components/dashboard/company-shell";
import { getRoiEvaluationDetail } from "@/modules/roi-evaluations/presentation/roi-api";
import { RoiExplorer } from "@/modules/roi-evaluations/presentation/roi-explorer";
import { roiTraces } from "@/modules/roi-evaluations/presentation/roi-trace";

export default async function RoiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getRoiEvaluationDetail(id);
  if (detail instanceof Response) notFound();
  return (
    <CompanyShell verifiedCompanyId={detail.snapshot.companyId}>
      <RoiExplorer
        currency={detail.snapshot.currency}
        scenarios={detail.scenarios.map(({ id, type }) => ({ id, type }))}
        evaluations={detail.evaluations.map((item) => ({
          id: item.id,
          scenarioId: item.scenarioId,
          title: item.title,
          description: item.description,
          confidence: Number(item.confidence),
        }))}
        metrics={detail.metrics.map((item) => ({
          evaluationId: item.evaluationId,
          code: item.code,
          unit: item.unit,
          specialValue: item.specialValue,
          value: item.value === null ? null : Number(item.value),
        }))}
        traces={roiTraces(detail)}
      />
    </CompanyShell>
  );
}
