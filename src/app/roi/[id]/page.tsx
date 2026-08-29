import { notFound } from "next/navigation";
import { getRoiEvaluationDetail } from "@/modules/roi-evaluations/presentation/roi-api";
import { RoiExplorer } from "@/modules/roi-evaluations/presentation/roi-explorer";

export default async function RoiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getRoiEvaluationDetail(id);
  if (detail instanceof Response) notFound();
  return (
    <RoiExplorer
      currency={detail.snapshot.currency}
      scenarios={detail.scenarios}
      evaluations={detail.evaluations.map((item) => ({
        ...item,
        confidence: Number(item.confidence),
      }))}
      metrics={detail.metrics.map((item) => ({
        ...item,
        value: item.value === null ? null : Number(item.value),
      }))}
    />
  );
}
