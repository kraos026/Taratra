import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ExecutiveAuditResult } from "../application/executive-result-model";

export function ExecutiveResultView({ result }: { result: ExecutiveAuditResult }) {
  const hub = `/companies/${result.company.id}/automation-audit`;
  if (!result.complete)
    return (
      <main className="mx-auto max-w-4xl space-y-5 p-6">
        <h1 className="text-3xl font-semibold">Automation Audit Results</h1>
        <Card>
          <CardContent className="space-y-4 py-8">
            <h2 className="text-xl font-semibold">Your Automation Audit is not complete yet.</h2>
            <p className="text-muted-foreground">
              Complete the current audit step before viewing final conclusions.
            </p>
            <Link className={cn(buttonVariants())} href={hub}>
              Continue the audit
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  return (
    <main className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6">
      <header>
        <p className="text-muted-foreground text-sm">Automation Audit Results</p>
        <h1 className="text-3xl font-semibold">{result.company.name}</h1>
        <p className="text-muted-foreground mt-2">
          Decision support based only on your published audit evidence.
        </p>
      </header>
      <section aria-labelledby="overview">
        <h2 id="overview" className="mb-3 text-2xl font-semibold">
          Executive overview
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(result.overview).map(([label, value]) => (
            <Card key={label}>
              <CardContent className="py-5">
                <p className="text-muted-foreground capitalize">{label}</p>
                <p className="text-3xl font-semibold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <section aria-labelledby="opportunities">
        <h2 id="opportunities" className="mb-3 text-2xl font-semibold">
          Priority opportunities
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {result.opportunities.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p>{item.problem}</p>
                <p className="text-muted-foreground text-sm">
                  Automation readiness: {item.readiness}% · Confidence: {item.confidence}%
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <section aria-labelledby="roi">
        <h2 id="roi" className="mb-3 text-2xl font-semibold">
          Expected impact
        </h2>
        <p className="text-muted-foreground mb-3">
          Published estimates in {result.roi?.currency}; these are not guaranteed savings.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {result.roi?.evaluations.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-3 gap-3">
                  <Metric
                    label="Annual benefit"
                    value={item.annualBenefit}
                    suffix={result.roi!.currency}
                  />
                  <Metric label="ROI" value={item.roi} special={item.roiSpecialValue} suffix="%" />
                  <Metric label="Payback" value={item.payback} suffix="months" />
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <section aria-labelledby="plan">
        <h2 id="plan" className="mb-3 text-2xl font-semibold">
          Recommended action plan
        </h2>
        <div className="space-y-4">
          {result.recommendations.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{item.title}</CardTitle>
                  <Badge>{item.priority}</Badge>
                  <Badge className="bg-neutral-100 text-neutral-700">{item.phase}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{item.action}</p>
                <p className="text-muted-foreground mt-1">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <section aria-labelledby="evidence">
        <h2 id="evidence" className="mb-3 text-2xl font-semibold">
          How these conclusions were reached
        </h2>
        <Card>
          <CardContent className="space-y-2 py-5">
            <p>
              Based on the published process “{result.process?.name}”, its business analysis,
              automation opportunities, ROI assumptions supplied by your team, and the published
              action plan.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                className={cn(buttonVariants({ variant: "outline" }))}
                href={`/process-maps/${result.provenance?.processMapId}`}
              >
                Review process
              </Link>
              <Link
                className={cn(buttonVariants({ variant: "outline" }))}
                href={`/roi/${result.provenance?.roiId}`}
              >
                Review ROI
              </Link>
              <Link
                className={cn(buttonVariants())}
                href={`/recommendations/${result.provenance?.recommendationPortfolioId}`}
              >
                Open action plan
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
function Metric({
  label,
  value,
  suffix,
  special,
}: {
  label: string;
  value: number | null;
  suffix: string;
  special?: string | null;
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="font-semibold">
        {special ?? (value === null ? "Unavailable" : `${value.toFixed(2)} ${suffix}`)}
      </dd>
    </div>
  );
}
