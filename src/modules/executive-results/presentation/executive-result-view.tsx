import Link from "next/link";
import {
  customerDecisionText,
  customerDecisionCenter,
  readableDecisionState,
} from "@/modules/company-intake/presentation/customer-decision-copy";
import { ProductionExecutiveDecisionViewBuilder } from "@/modules/company-intake/application/production-executive-decision-view";
import { PatronDecisionCenterPresenter } from "@/modules/company-intake/application/patron-decision-center";
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
import { PilotFeedbackDialog } from "@/modules/pilot-feedback/presentation/pilot-feedback-dialog";
import type { ExecutiveAuditResult } from "../application/executive-result-model";
import { DecisionBrief } from "@/modules/company-intake/presentation/decision-brief";
import { attributableEvaluation, repeatedEstimates } from "./result-economics";

export function ExecutiveResultView({ result }: { readonly result: ExecutiveAuditResult }) {
  const hub = `/companies/${result.company.id}/automation-audit`;
  const projection = new ProductionExecutiveDecisionViewBuilder().build({
    tenantId: result.organizationId ?? "",
    result,
  }).view;
  if (!projection)
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

  const center = customerDecisionCenter(PatronDecisionCenterPresenter.build(projection));
  const cards = center.priorityCards;
  const opportunityCard = (id: string) =>
    cards.find((card) => card.sourceCardId === `opportunity:${id}`);
  const recommendationCard = (id: string, title: string) =>
    cards.find((card) => card.sourceCardId === `recommendation:${id}`) ??
    (result.opportunities.filter((item) => item.title === title).length === 1
      ? opportunityCard(result.opportunities.find((item) => item.title === title)!.id)
      : undefined);
  return (
    <main className="result-experience min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="result-hero rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/70 p-6 sm:p-8">
          <div className="journey-action-icon">
            <CheckCircle2 size={28} aria-hidden />
          </div>
          <p className="text-xs font-bold tracking-[0.28em] text-blue-300 uppercase">
            Résultats Optivos · optivos.vip
          </p>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-['Manrope'] text-2xl font-extrabold sm:text-3xl">
                Votre audit Optivos est terminé
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Synthèse finale pour {brandText(result.company.name)}, fondée uniquement sur les
                éléments publiés. Les conditions et validations humaines restent applicables.
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

        <DecisionBrief center={center} />

        <section className="grid gap-4 md:grid-cols-3">
          <HeroCard
            icon={<CheckCircle2 />}
            label="Opportunités qualifiées"
            value={String(center.overview.automationReadyCount)}
            text="Même état canonique que le centre de décision"
          />
          <HeroCard
            icon={<CircleDollarSign />}
            label="État économique"
            value={result.roi ? "Publié" : "À compléter"}
            text={result.roi ? `Devise ${result.roi.currency}` : "Aucun chiffre inventé"}
          />
          <HeroCard
            icon={<ShieldCheck />}
            label="Votre décision"
            value="À examiner"
            text="L’audit ne déploie aucune automatisation"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-6">
            <Panel title="Décisions prioritaires">
              <div className="grid gap-4 lg:grid-cols-3">
                {cards.slice(0, 3).map((item, index) => (
                  <article
                    key={item.sourceCardId}
                    className="rounded-3xl border border-white/10 bg-slate-950/70 p-4"
                  >
                    <p className="text-xs font-bold tracking-[0.18em] text-blue-300 uppercase">
                      #{index + 1} · {priorityLabel(item.priority)}
                    </p>
                    <h3 className="mt-2 text-lg font-bold">{brandText(item.title)}</h3>
                    <p className="mt-3 text-sm font-semibold text-blue-100">
                      {readableDecisionState(item.decisionState)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{item.whatToDoNow}</p>
                    <p className="mt-3 rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
                      {item.whatNotToDo ?? "Examiner les preuves avant de valider la conception."}
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
                    <p className="mt-2 text-sm text-slate-300">{brandText(item.description)}</p>
                    <p className="mt-2 text-sm text-slate-400">
                      Piste de traitement à examiner : {brandText(item.impact)}
                    </p>
                    <p className="mt-3 rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-100">
                      Sévérité : {priorityLabel(item.severity)}
                    </p>
                  </article>
                ))}
                {!result.findings.length && (
                  <EmptyState text="Aucun risque principal publié dans le résultat final." />
                )}
              </div>
            </Panel>

            <Panel title="Opportunités retenues" collapsible>
              <div className="grid gap-4 md:grid-cols-2">
                {result.opportunities.slice(0, 3).map((item) => (
                  <article
                    key={item.id}
                    className="rounded-3xl border border-white/10 bg-slate-950/60 p-4"
                  >
                    <h3 className="font-bold">{brandText(item.title)}</h3>
                    <p className="mt-2 text-sm text-slate-300">{brandText(item.problem)}</p>
                    <p className="mt-3 text-sm font-semibold text-amber-100">
                      {readableDecisionState(
                        opportunityCard(item.id)?.decisionState ?? "NEEDS_MORE_EVIDENCE",
                      )}
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      {opportunityCard(item.id)?.whatToDoNow}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <State label="Maturité" value={`${item.readiness}%`} />
                      <State label="Indice interne" value={`${item.confidence}%`} />
                    </div>
                  </article>
                ))}
                {!result.opportunities.length && (
                  <EmptyState text="Aucune opportunité publiée dans le résultat final." />
                )}
              </div>
            </Panel>

            <Panel title="Plan d’action recommandé" collapsible>
              <div className="space-y-3">
                {result.recommendations.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-3xl border border-white/10 bg-slate-950/60 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{brandText(item.title)}</h3>
                      <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs text-blue-100">
                        {priorityLabel(item.priority)}
                      </span>
                      <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
                        {phaseLabel(item.phase)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-blue-100">{brandText(item.action)}</p>
                    <p className="mt-2 text-sm font-semibold text-amber-100">
                      {readableDecisionState(
                        recommendationCard(item.id, item.title)?.decisionState ??
                          "NEEDS_MORE_EVIDENCE",
                      )}
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      {recommendationCard(item.id, item.title)?.whatNotToDo ??
                        "La proposition doit être reliée à ses preuves avant validation."}
                    </p>
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
                sont pas des gains garantis. Des hypothèses peuvent être communes à plusieurs
                opportunités : ces montants ne doivent pas être additionnés sans vérifier les
                recouvrements.
              </p>
              {repeatedEstimates(result) && (
                <p
                  role="status"
                  className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100"
                >
                  Plusieurs pistes affichent les mêmes estimations. Vérifiez les hypothèses propres
                  à chacune et les recouvrements ; cela ne démontre ni des gains indépendants ni une
                  erreur de calcul.
                </p>
              )}
              <div className="space-y-3">
                {result.roi?.evaluations.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-3xl border border-white/10 bg-slate-950/60 p-4"
                  >
                    <h3 className="font-bold">{brandText(item.title)}</h3>
                    {attributableEvaluation(result, item) ? (
                      <dl className="mt-3 grid gap-2">
                        <Metric
                          label="Bénéfice annuel"
                          value={item.annualBenefit}
                          suffix={result.roi!.currency}
                        />
                        <Metric
                          label="Retour sur investissement"
                          value={item.roi}
                          special={item.roiSpecialValue}
                          suffix="%"
                        />
                        <Metric
                          label="Délai estimé de rentabilité"
                          value={item.payback}
                          suffix="mois"
                        />
                      </dl>
                    ) : (
                      <p className="mt-3 text-sm text-amber-100">
                        Estimation non attribuable : cette évaluation doit être reliée sans
                        ambiguïté à une opportunité de ce dossier avant d’afficher ses montants
                        comme ses gains.
                      </p>
                    )}
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

            <Panel title="Votre avis sur cet audit">
              <p className="text-sm leading-6 text-slate-300">
                Ces conclusions vous aident-elles à décider ? Partagez votre avis pour améliorer
                Optivos.
              </p>
              <div className="mt-4">
                <PilotFeedbackDialog companyId={result.company.id} />
              </div>
            </Panel>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Panel({
  title,
  children,
  collapsible = false,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly collapsible?: boolean;
}) {
  if (collapsible)
    return (
      <details className="result-panel rounded-[1.75rem] border border-white/10 bg-slate-900/75 p-5">
        <summary className="cursor-pointer py-2 text-lg font-bold focus-visible:outline-2 focus-visible:outline-blue-400">
          {title}
        </summary>
        <div className="mt-4">{children}</div>
      </details>
    );
  return (
    <section className="result-panel rounded-[1.75rem] border border-white/10 bg-slate-900/75 p-5">
      <h2 className="text-xl font-bold">{title}</h2>
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
    <article className="result-metric rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-5">
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
        special
          ? special === "unbounded"
            ? "Ratio non borné — coût nul déclaré, hypothèse à vérifier"
            : "État de calcul à vérifier"
          : value === null || !Number.isFinite(value)
            ? "Données complémentaires requises"
            : `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${suffix}`
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
  return customerDecisionText(value);
}

function priorityLabel(value: string): string {
  return (
    (
      { critical: "Critique", high: "Haute", medium: "Moyenne", low: "Basse" } as Record<
        string,
        string
      >
    )[value.toLowerCase()] ?? customerDecisionText(value)
  );
}

function phaseLabel(value: string): string {
  return customerDecisionText(value).replace(/^phase_(\d+)$/i, "$1");
}
