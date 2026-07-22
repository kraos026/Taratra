import type { AuditReport } from "../domain/audit-report";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export function ExecutiveSummary({ summary }: { summary: AuditReport["summary"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Executive Summary</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-3">
        <SummaryList title="Points forts" values={summary.strengths} />
        <SummaryList title="Risques" values={summary.risks} />
        <SummaryList title="Top 5 recommandations" values={summary.topRecommendations} />
        <p className="text-sm text-neutral-600 md:col-span-3 dark:text-neutral-300">
          <strong>Résumé ROI : </strong>
          {summary.roiText}
        </p>
      </CardContent>
    </Card>
  );
}
function SummaryList({ title, values }: { title: string; values: string[] }) {
  return (
    <section aria-labelledby={title.replaceAll(" ", "-")}>
      <h3 id={title.replaceAll(" ", "-")} className="font-semibold">
        {title}
      </h3>
      {values.length ? (
        <ul className="mt-2 list-inside list-disc text-sm text-neutral-600 dark:text-neutral-300">
          {values.map((v) => (
            <li key={v}>{v}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-neutral-500">Aucune donnée disponible</p>
      )}
    </section>
  );
}
