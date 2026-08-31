import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  ShieldCheck,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExecutiveAuditResult } from "../application/executive-result-model";

export function ExecutiveResultView({ result }: { readonly result: ExecutiveAuditResult }) {
  const hub = `/companies/${result.company.id}/automation-audit`;
  if (!result.complete)
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-50">
        <section className="mx-auto max-w-4xl rounded-[2rem] border border-amber-400/30 bg-amber-500/10 p-8">
          <AlertTriangle className="text-amber-200" />
          <h1 className="mt-4 text-3xl font-bold">Résultats Optivos non disponibles</h1>
          <p className="mt-3 text-slate-300">
            L’audit doit être complété avant d’afficher les conclusions finales. Optivos ne fabrique
            pas de décision sans résultat validé.
          </p>
          <Link className={cn(buttonVariants(), "mt-6")} href={hub}>
            Continuer l’audit
          </Link>
        </section>
      </main>
    );

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/70 p-6 sm:p-8">
          <p className="text-xs font-bold tracking-[0.28em] text-blue-300 uppercase">
            Résultats Optivos · optivos.vip
          </p>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-['Manrope'] text-3xl font-extrabold sm:text-5xl">
                Votre audit Optivos est terminé
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Synthèse finale pour {brandText(result.company.name)}, fondée uniquement sur les
                preuves, le ROI et le plan d’action validés.
              </p>
            </div>
            <Link
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/25"
              href={`/companies/${result.company.id}/automation-audit/decision-center`}
            >
              Ouvrir le centre de décision <ArrowRight size={17} />
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <HeroCard
            icon={<CheckCircle2 />}
            label="Actions prioritaires"
            value={String(result.recommendations.slice(0, 3).length)}
            text="Top décisions à lire en premier"
          />
          <HeroCard
            icon={<CircleDollarSign />}
            label="État économique"
            value={result.roi ? "Publié" : "À compléter"}
            text={result.roi ? `Devise ${result.roi.currency}` : "Aucun chiffre inventé"}
          />
          <HeroCard
            icon={<ShieldCheck />}
            label="Contrôle humain"
            value="Visible"
            text="Risques et validations restent explicites"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-6">
            <Panel title="Top 3 décisions">
              <div className="grid gap-4 lg:grid-cols-3">
                {result.recommendations.slice(0, 3).map((item, index) => (
                  <article
                    key={item.id}
                    className="rounded-3xl border border-white/10 bg-slate-950/70 p-4"
                  >
                    <p className="text-xs font-bold tracking-[0.18em] text-blue-300 uppercase">
                      #{index + 1} · {item.priority}
                    </p>
                    <h3 className="mt-2 text-lg font-bold">{brandText(item.title)}</h3>
                    <p className="mt-3 text-sm font-semibold text-blue-100">
                      {brandText(item.action)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {brandText(item.description)}
                    </p>
                    <p className="mt-3 rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
                      Phase : {item.phase}
                    </p>
                  </article>
                ))}
              </div>
            </Panel>

            <Panel title="Risques principaux">
              <div className="grid gap-4 md:grid-cols-2">
                {result.findings.slice(0, 4).map((item) => (
                  <article
                    key={item.id}
                    className="rounded-3xl border border-white/10 bg-slate-950/60 p-4"
                  >
                    <h3 className="font-bold">{brandText(item.title)}</h3>
                    <p className="mt-2 text-sm text-slate-300">{brandText(item.impact)}</p>
                    <p className="mt-3 rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-100">
                      Sévérité : {item.severity}
                    </p>
                  </article>
                ))}
                {!result.findings.length && (
                  <EmptyState text="Aucun risque principal publié dans le résultat final." />
                )}
              </div>
            </Panel>

            <Panel title="Opportunités retenues">
              <div className="grid gap-4 md:grid-cols-2">
                {result.opportunities.slice(0, 3).map((item) => (
                  <article
                    key={item.id}
                    className="rounded-3xl border border-white/10 bg-slate-950/60 p-4"
                  >
                    <h3 className="font-bold">{brandText(item.title)}</h3>
                    <p className="mt-2 text-sm text-slate-300">{brandText(item.problem)}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <State label="Maturité" value={`${item.readiness}%`} />
                      <State label="Confiance" value={`${item.confidence}%`} />
                    </div>
                  </article>
                ))}
                {!result.opportunities.length && (
                  <EmptyState text="Aucune opportunité publiée dans le résultat final." />
                )}
              </div>
            </Panel>

            <Panel title="Plan d’action recommandé">
              <div className="space-y-3">
                {result.recommendations.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-3xl border border-white/10 bg-slate-950/60 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{brandText(item.title)}</h3>
                      <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs text-blue-100">
                        {item.priority}
                      </span>
                      <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
                        {item.phase}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-blue-100">{brandText(item.action)}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">
                      {brandText(item.description)}
                    </p>
                  </article>
                ))}
              </div>
            </Panel>
          </div>

          <aside className="space-y-6">
            <Panel title="Impact attendu">
              <p className="mb-4 text-sm text-slate-300">
                Estimations publiées en {result.roi?.currency ?? "devise non disponible"}; ce ne
                sont pas des gains garantis.
              </p>
              <div className="space-y-3">
                {result.roi?.evaluations.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-3xl border border-white/10 bg-slate-950/60 p-4"
                  >
                    <h3 className="font-bold">{brandText(item.title)}</h3>
                    <dl className="mt-3 grid gap-2">
                      <Metric
                        label="Bénéfice annuel"
                        value={item.annualBenefit}
                        suffix={result.roi!.currency}
                      />
                      <Metric
                        label="ROI"
                        value={item.roi}
                        special={item.roiSpecialValue}
                        suffix="%"
                      />
                      <Metric label="Retour" value={item.payback} suffix="mois" />
                    </dl>
                  </article>
                )) ?? <EmptyState text="ROI non disponible. Aucune valeur n’est inventée." />}
              </div>
            </Panel>

            <Panel title="Prochaine étape">
              <p className="text-sm leading-6 text-slate-300">
                Ouvrez le centre de décision pour examiner les détails, puis validez le plan ou
                complétez les données manquantes selon l’état publié.
              </p>
              <Link
                className={cn(buttonVariants(), "mt-4")}
                href={`/companies/${result.company.id}/automation-audit/decision-center`}
              >
                Ouvrir le centre de décision
              </Link>
            </Panel>

            <Panel title="Pourquoi ces conclusions ?">
              <p className="text-sm leading-6 text-slate-300">
                Fondé sur le processus validé “{brandText(result.process?.name ?? "non disponible")}
                ”, son analyse métier, les opportunités d’automatisation, les hypothèses ROI et le
                plan d’action validé.
              </p>
              <div className="mt-4 flex flex-col gap-3">
                {result.provenance?.processMapId && (
                  <Link
                    className={cn(buttonVariants({ variant: "outline" }))}
                    href={`/process-maps/${result.provenance.processMapId}`}
                  >
                    Revoir le processus
                  </Link>
                )}
                {result.provenance?.roiId && (
                  <Link
                    className={cn(buttonVariants({ variant: "outline" }))}
                    href={`/roi/${result.provenance.roiId}`}
                  >
                    Revoir le ROI
                  </Link>
                )}
                {result.provenance?.recommendationPortfolioId && (
                  <Link
                    className={cn(buttonVariants())}
                    href={`/recommendations/${result.provenance.recommendationPortfolioId}`}
                  >
                    Ouvrir le plan d’action
                  </Link>
                )}
              </div>
            </Panel>

            <Panel title="Feedback pilote">
              <p className="text-sm leading-6 text-slate-300">
                Emplacement préparé pour la prochaine phase : compréhension, pertinence, crédibilité
                ROI, clarté du prochain pas, expérience d’audit, volonté de payer et prix.
              </p>
              <p className="mt-3 rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-400">
                Aucun stockage feedback n’est activé dans cette mission.
              </p>
            </Panel>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Panel({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-slate-900/75 p-5">
      <h2 className="text-2xl font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function HeroCard({
  icon,
  label,
  value,
  text,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
  readonly text: string;
}) {
  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-5">
      <div className="flex items-center gap-2 text-blue-200">
        {icon}
        <p className="text-xs font-bold tracking-[0.16em] uppercase">{label}</p>
      </div>
      <p className="mt-3 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{text}</p>
    </article>
  );
}

function State({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  suffix,
  special,
}: {
  readonly label: string;
  readonly value: number | null;
  readonly suffix: string;
  readonly special?: string | null;
}) {
  return (
    <State
      label={label}
      value={
        special ??
        (value === null ? "Données complémentaires requises" : `${value.toFixed(2)} ${suffix}`)
      }
    />
  );
}

function EmptyState({ text }: { readonly text: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-400">
      {text}
    </p>
  );
}

function brandText(value: string): string {
  return value.replaceAll("AutomateX", "Optivos").replaceAll("AUTOMATEX", "OPTIVOS");
}
