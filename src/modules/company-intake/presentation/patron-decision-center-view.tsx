import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  PatronDecisionCard,
  PatronDecisionCenter,
  PatronDecisionCenterEconomics,
} from "../application/patron-decision-center";
import { AskAutomateXPanel } from "./ask-automatex-panel";

export function PatronDecisionCenterView({ center }: { readonly center: PatronDecisionCenter }) {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/70 p-6 shadow-2xl shadow-blue-950/20 sm:p-8">
          <Badge className="w-fit bg-blue-500/15 text-blue-200">Centre de décision Optivos</Badge>
          <h1 className="mt-3 font-['Manrope'] text-3xl font-extrabold tracking-tight sm:text-5xl">
            Centre de décision exécutif
          </h1>
          <p className="max-w-3xl text-sm text-slate-300">
            Une vue fondée sur les preuves pour décider quoi automatiser en premier, quoi corriger,
            quelles preuves manquent et quels contrôles humains doivent rester visibles.
          </p>
        </header>

        <Overview center={center} />
        <AskAutomateXEntry center={center} />
        <ExecutiveSummary center={center} />

        <section className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
          <div className="flex flex-col gap-6">
            <TextList
              title="Priorités"
              items={center.topProblems}
              empty="Aucun problème prioritaire n’est encore disponible."
            />
            <DecisionSection
              title="À corriger avant automatisation"
              description="Les corrections restent visibles lorsqu’une automatisation amplifierait un risque, une faiblesse de processus ou une donnée fragile."
              cards={center.fixBeforeAutomating}
              empty="Aucune décision de correction préalable n’est disponible."
            />
            <DecisionSection
              title="Priorités d’automatisation"
              description="Seules les opportunités déjà qualifiées comme automatisables sont affichées ici."
              cards={center.automationOpportunities}
              empty="Aucune opportunité prête à automatiser n’est disponible."
            />
            <DecisionSection
              title="Ne pas automatiser / reporter"
              description="Les exclusions, reports et décisions nécessitant un contrôle humain restent visibles."
              cards={center.doNotAutomate}
              empty="Aucune décision d’exclusion n’est disponible."
            />
            <Knowledge center={center} />
            <Evidence center={center} />
          </div>

          <aside className="flex flex-col gap-6">
            <Economics economics={center.economics} />
            <NextActions center={center} />
            <TextList
              title="Risques & contrôles"
              items={[
                ...center.rootCausesOrHypotheses,
                ...center.bottlenecks,
                ...center.criticalIssues,
              ]}
              empty="Aucune synthèse des causes ou blocages n’est disponible."
            />
          </aside>
        </section>
      </div>
    </main>
  );
}

function Overview({ center }: { readonly center: PatronDecisionCenter }) {
  const overview = center.overview;
  return (
    <section aria-labelledby="decision-center-overview">
      <Card className="border-blue-900/60 bg-slate-900/80 text-slate-50">
        <CardHeader>
          <CardTitle id="decision-center-overview">Vue exécutive</CardTitle>
          <CardDescription className="text-slate-300">
            {brandText(overview.companyName)} · {readableDecisionState(overview.auditStatus)}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="Priorités" value={overview.topProblemsCount} />
          <Metric label="À automatiser" value={overview.automationReadyCount} />
          <Metric label="À corriger" value={overview.fixBeforeAutomationCount} />
          <Metric label="À ne pas automatiser" value={overview.doNotAutomateCount} />
          <Metric label="Données manquantes" value={overview.needsMoreEvidenceCount} />
          <Metric label="ROI" value={readableEconomicState(overview.economicReadiness)} />
          <div className="rounded-lg border border-blue-900/60 bg-blue-950/40 p-4 sm:col-span-2 xl:col-span-6">
            <p className="text-xs tracking-wide text-slate-400 uppercase">Prochaine action</p>
            <p className="mt-2 text-base font-semibold">
              {brandText(overview.topNextAction ?? "Données complémentaires requises")}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Incertitude : {readableUncertainty(overview.uncertaintyIndicator)}
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function AskAutomateXEntry({ center }: { readonly center: PatronDecisionCenter }) {
  return (
    <section aria-labelledby="ask-automatex">
      <Card className="border-blue-700/60 bg-gradient-to-br from-blue-950/70 to-slate-900/80 text-slate-50">
        <CardHeader>
          <Badge className="w-fit bg-blue-500/20 text-blue-100">Ask Optivos</Badge>
          <CardTitle id="ask-automatex">Interroger ce résultat</CardTitle>
          <CardDescription className="text-slate-300">
            Les réponses exécutives s’appuient uniquement sur les décisions validées de cette
            entreprise, les preuves, les incertitudes, l’économie et les stratégies retenues.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AskAutomateXPanel center={center} />
        </CardContent>
      </Card>
    </section>
  );
}

function ExecutiveSummary({ center }: { readonly center: PatronDecisionCenter }) {
  return (
    <section aria-labelledby="executive-summary">
      <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
        <CardHeader>
          <CardTitle id="executive-summary">Synthèse exécutive</CardTitle>
          <CardDescription className="text-slate-300">
            Synthèse issue uniquement des décisions publiées pour cette entreprise.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-base leading-7 text-slate-100">{brandText(center.executiveSummary)}</p>
          {center.status === "UNAVAILABLE" ? (
            <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
              Analyse indisponible : aucune décision exécutive n’est inventée pour cette entreprise.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function DecisionSection({
  title,
  description,
  cards,
  empty,
}: {
  readonly title: string;
  readonly description: string;
  readonly cards: readonly PatronDecisionCard[];
  readonly empty: string;
}) {
  return (
    <section aria-labelledby={slug(title)}>
      <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
        <CardHeader>
          <CardTitle id={slug(title)}>{title}</CardTitle>
          <CardDescription className="text-slate-300">{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {cards.length ? (
            cards.map((card) => <DecisionCard key={card.sourceCardId} card={card} />)
          ) : (
            <EmptyState text={empty} />
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function DecisionCard({ card }: { readonly card: PatronDecisionCard }) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-semibold">{brandText(card.title)}</h3>
          <p className="mt-1 text-sm text-slate-300">{brandText(card.executiveSummary)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className={decisionBadgeClass(card.decisionState)}>
            {readableDecisionState(card.decisionState)}
          </Badge>
          <Badge className="bg-slate-800 text-slate-100">{card.priority}</Badge>
          <Badge className="bg-blue-500/15 text-blue-200">
            Preuves : {readableEvidenceStrength(card.evidenceStrength)}
          </Badge>
          <Badge className={roiBadgeClass(card.economicState)}>
            ROI: {readableRoiState(card.economicState)}
          </Badge>
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-sm md:grid-cols-3">
        <StatePill label="Impact" value={brandText(card.businessImpact)} />
        <StatePill
          label="Risque / contrôle"
          value={brandText(card.whatNotToDo ?? "Aucun blocage publié")}
        />
        <StatePill label="Prochaine action" value={brandText(card.whatToDoNow)} />
      </div>
      <dl className="mt-4 grid gap-3 md:grid-cols-2">
        <Info label="Pourquoi" value={card.businessImpact} />
        <Info label="Action recommandée" value={brandText(card.whatToDoNow)} />
        <Info label="Cause probable" value={brandText(card.probableCause)} />
        <Info label="ROI & preuves" value={readableRoiState(card.economicState)} />
      </dl>
      {card.whatNotToDo ? (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
          Ne pas faire : {brandText(card.whatNotToDo)}
        </p>
      ) : null}
      <details className="mt-4 rounded-lg border border-slate-800 bg-slate-900/80 p-3">
        <summary className="cursor-pointer font-semibold text-blue-200">Pourquoi ?</summary>
        <div className="mt-3 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
          <ListBlock title="Preuves utilisées" items={card.evidenceReferences} />
          <ListBlock title="Incertitudes et contradictions" items={card.uncertainty} />
        </div>
      </details>
    </article>
  );
}

function Knowledge({ center }: { readonly center: PatronDecisionCenter }) {
  return (
    <section aria-labelledby="know-believe-unknown">
      <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
        <CardHeader>
          <CardTitle id="know-believe-unknown">Ce qui est connu, supposé et manquant</CardTitle>
          <CardDescription className="text-slate-300">
            Les faits, hypothèses et inconnues restent séparés pour éviter toute fausse certitude.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <ListBlock title="Ce qui est connu" items={center.knowledge.whatWeKnow} />
          <ListBlock title="Ce qui est supposé" items={center.knowledge.whatWeBelieve} />
          <ListBlock title="Ce qui manque" items={center.knowledge.whatWeDoNotKnow} />
        </CardContent>
      </Card>
    </section>
  );
}

function Evidence({ center }: { readonly center: PatronDecisionCenter }) {
  return (
    <section aria-labelledby="evidence-and-why">
      <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
        <CardHeader>
          <CardTitle id="evidence-and-why">ROI & preuves</CardTitle>
          <CardDescription className="text-slate-300">
            Les sources restent lisibles sans exposer d’identifiants techniques.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <ListBlock title="Preuves utilisées" items={center.evidence.supportingSources} />
          <ListBlock title="Données manquantes" items={center.evidence.missingEvidence} />
          <ListBlock title="Preuves contradictoires" items={center.evidence.conflictingSources} />
          <ListBlock title="Contradictions importantes" items={center.evidence.contradictions} />
        </CardContent>
      </Card>
    </section>
  );
}

function Economics({ economics }: { readonly economics: PatronDecisionCenterEconomics }) {
  return (
    <section aria-labelledby="economics">
      <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
        <CardHeader>
          <CardTitle id="economics">Potentiel économique</CardTitle>
          <CardDescription className="text-slate-300">
            Seuls les résultats économiques validés sont affichés. Une preuve manquante reste une
            preuve manquante, pas un zéro.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Info label="État économique" value={readableRoiState(economics.state)} />
          <Info
            label="Potentiel annuel"
            value={formatRange(economics.benefitRange, economics.currency)}
          />
          <Info label="Coût estimé" value={formatRange(economics.costRange, economics.currency)} />
          <Info label="Seuil de rentabilité" value={formatMonths(economics.breakEvenMonths)} />
          <Info label="Temps avant valeur" value={formatMonths(economics.timeToValueMonths)} />
          <Info
            label="Coût de l’inaction"
            value={formatMoney(economics.costOfInaction, economics.currency)}
          />
          <ListBlock title="Données économiques manquantes" items={economics.missingEvidence} />
        </CardContent>
      </Card>
    </section>
  );
}

function NextActions({ center }: { readonly center: PatronDecisionCenter }) {
  return (
    <section aria-labelledby="next-best-actions">
      <Card className="border-blue-900/60 bg-blue-950/30 text-slate-50">
        <CardHeader>
          <CardTitle id="next-best-actions">Prochaine action</CardTitle>
          <CardDescription className="text-slate-300">
            Priorisée uniquement à partir des résultats publiés.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {center.nextActions.length ? (
            <ol className="space-y-3">
              {center.nextActions.slice(0, 3).map((action, index) => (
                <li key={`${action.category}:${action.label}`} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold">{brandText(action.label)}</p>
                    <p className="text-sm text-slate-300">
                      {readableActionCategory(action.category)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState text="Aucune prochaine action n’est publiée pour le moment." />
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function TextList({
  title,
  items,
  empty,
}: {
  readonly title: string;
  readonly items: readonly string[];
  readonly empty: string;
}) {
  return (
    <section aria-labelledby={slug(title)}>
      <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
        <CardHeader>
          <CardTitle id={slug(title)}>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ListBlock title={title} items={items} empty={empty} hideTitle />
        </CardContent>
      </Card>
    </section>
  );
}

function Metric({ label, value }: { readonly label: string; readonly value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs tracking-wide text-slate-400 uppercase">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Info({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-slate-400 uppercase">{label}</dt>
      <dd className="mt-1 text-sm text-slate-100">{value}</dd>
    </div>
  );
}

function StatePill({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <p className="text-xs tracking-wide text-slate-400 uppercase">{label}</p>
      <p className="mt-1 text-slate-100">{value}</p>
    </div>
  );
}

function ListBlock({
  title,
  items,
  empty = "Données complémentaires requises",
  hideTitle = false,
}: {
  readonly title: string;
  readonly items: readonly string[];
  readonly empty?: string;
  readonly hideTitle?: boolean;
}) {
  return (
    <div>
      {hideTitle ? null : <h3 className="text-sm font-semibold text-slate-100">{title}</h3>}
      {items.length ? (
        <ul className="mt-2 space-y-2 text-sm text-slate-300">
          {items.map((item) => (
            <li key={item} className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2">
              {brandText(item)}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState text={empty} />
      )}
    </div>
  );
}

function EmptyState({ text }: { readonly text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-700 bg-slate-950/50 p-3 text-sm text-slate-400">
      {text}
    </p>
  );
}

function readableDecisionState(state: string): string {
  const labels: Record<string, string> = {
    AUTOMATE_NOW: "Automatiser maintenant",
    AUTOMATE_AFTER_REMEDIATION: "Automatiser après correction",
    AUTOMATE_CONDITIONALLY: "Automatiser sous conditions",
    NEEDS_MORE_EVIDENCE: "Données supplémentaires requises",
    DEFER: "Reporter",
    DO_NOT_AUTOMATE: "Ne pas automatiser",
    FIX_BEFORE_AUTOMATING: "Corriger avant d’automatiser",
    INVESTIGATE_FIRST: "Investiguer d’abord",
    HUMAN_DECISION_REQUIRED: "Validation humaine requise",
  };
  if (labels[state]) return labels[state];
  return state
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function readableEconomicState(state: string): string {
  if (state === "NOT_YET_AVAILABLE") return "Données complémentaires requises";
  return readableRoiState(state);
}

function readableRoiState(state: string): string {
  const labels: Record<string, string> = {
    CALCULATED: "Calculé",
    ESTIMATED: "Estimé",
    INSUFFICIENT_EVIDENCE: "Données complémentaires requises",
    STRATEGIC_NON_QUANTIFIED: "Stratégique non quantifié",
    ECONOMICALLY_JUSTIFIED: "Justifié économiquement",
    NOT_YET_AVAILABLE: "Non disponible",
  };
  return labels[state] ?? readableEconomicState(state);
}

function readableEvidenceStrength(strength: string): string {
  const labels: Record<string, string> = {
    STRONG: "fortes",
    MODERATE: "moyennes",
    WEAK: "faibles",
  };
  return labels[strength] ?? strength.toLowerCase();
}

function readableUncertainty(value: string): string {
  if (value === "MATERIAL") return "contradiction importante visible";
  if (value === "DECLARED") return "incertitude déclarée";
  return "aucune incertitude déclarée";
}

function readableActionCategory(category: string): string {
  return readableDecisionState(category);
}

function decisionBadgeClass(state: string): string {
  if (state === "AUTOMATE_NOW" || state === "AUTOMATE_CONDITIONALLY")
    return "bg-emerald-500/15 text-emerald-200";
  if (state === "FIX_BEFORE_AUTOMATING" || state === "AUTOMATE_AFTER_REMEDIATION")
    return "bg-amber-500/15 text-amber-200";
  if (state === "NEEDS_MORE_EVIDENCE" || state === "DEFER" || state === "INVESTIGATE_FIRST")
    return "bg-yellow-500/15 text-yellow-100";
  if (state === "DO_NOT_AUTOMATE" || state === "HUMAN_DECISION_REQUIRED")
    return "bg-red-500/15 text-red-200";
  return "bg-slate-800 text-slate-100";
}

function roiBadgeClass(state: string): string {
  if (state === "CALCULATED" || state === "ECONOMICALLY_JUSTIFIED")
    return "bg-emerald-500/15 text-emerald-200";
  if (state === "ESTIMATED" || state === "STRATEGIC_NON_QUANTIFIED")
    return "bg-blue-500/15 text-blue-200";
  if (state === "INSUFFICIENT_EVIDENCE" || state === "NOT_YET_AVAILABLE")
    return "bg-amber-500/15 text-amber-100";
  return "bg-slate-800 text-slate-100";
}

function formatRange(range: readonly [number | null, number | null], currency: string | null) {
  if (range[0] === null && range[1] === null) return "Données complémentaires requises";
  if (range[0] === range[1]) return formatMoney(range[0], currency);
  return `${formatMoney(range[0], currency)} - ${formatMoney(range[1], currency)}`;
}

function formatMoney(value: number | null, currency: string | null) {
  if (value === null) return "Données complémentaires requises";
  return `${value.toLocaleString("fr-FR")} ${currency ?? ""}`.trim();
}

function formatMonths(value: number | null) {
  if (value === null) return "Données complémentaires requises";
  return `${value} mois`;
}

function slug(value: string): string {
  return value.toLowerCase().replaceAll(" ", "-").replaceAll("/", "").replaceAll("?", "");
}

function brandText(value: string | null): string {
  return (value ?? "").replaceAll("AutomateX", "Optivos").replaceAll("AUTOMATEX", "OPTIVOS");
}
