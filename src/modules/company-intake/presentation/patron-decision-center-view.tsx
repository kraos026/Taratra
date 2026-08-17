import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  PatronDecisionCard,
  PatronDecisionCenter,
  PatronDecisionCenterEconomics,
} from "../application/patron-decision-center";

export function PatronDecisionCenterView({ center }: { readonly center: PatronDecisionCenter }) {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <Badge className="w-fit bg-blue-500/15 text-blue-200">Patron Decision Center</Badge>
          <h1 className="text-3xl font-bold tracking-tight">Executive audit decision center</h1>
          <p className="max-w-3xl text-sm text-slate-300">
            A fast, evidence-backed view of what is wrong, what to fix first, what not to automate,
            and what can safely move forward.
          </p>
        </header>

        <Overview center={center} />
        <AskAutomateXEntry center={center} />
        <ExecutiveSummary center={center} />

        <section className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
          <div className="flex flex-col gap-6">
            <TextList
              title="Top problems"
              items={center.topProblems}
              empty="No material problem published yet."
            />
            <DecisionSection
              title="Fix before automating"
              description="Remediation is shown first when automation would amplify a process, data, or control weakness."
              cards={center.fixBeforeAutomating}
              empty="No fix-before-automation decision is currently published."
            />
            <DecisionSection
              title="Automation opportunities"
              description="Only opportunities already marked automate now or automate conditionally are shown here."
              cards={center.automationOpportunities}
              empty="No automation-ready opportunity is currently published."
            />
            <DecisionSection
              title="Do not automate"
              description="Rejected and human-control decisions remain visible instead of being hidden."
              cards={center.doNotAutomate}
              empty="No do-not-automate decision is currently published."
            />
            <Knowledge center={center} />
            <Evidence center={center} />
          </div>

          <aside className="flex flex-col gap-6">
            <Economics economics={center.economics} />
            <NextActions center={center} />
            <TextList
              title="Root causes and bottlenecks"
              items={[
                ...center.rootCausesOrHypotheses,
                ...center.bottlenecks,
                ...center.criticalIssues,
              ]}
              empty="No root-cause or bottleneck summary is published yet."
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
          <CardTitle id="decision-center-overview">Overview</CardTitle>
          <CardDescription className="text-slate-300">
            Company {overview.companyName} · {overview.auditStatus}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="Top problems" value={overview.topProblemsCount} />
          <Metric label="Ready to automate" value={overview.automationReadyCount} />
          <Metric label="Fix first" value={overview.fixBeforeAutomationCount} />
          <Metric label="Do not automate" value={overview.doNotAutomateCount} />
          <Metric label="Need evidence" value={overview.needsMoreEvidenceCount} />
          <Metric label="Economics" value={readableEconomicState(overview.economicReadiness)} />
          <div className="rounded-lg border border-blue-900/60 bg-blue-950/40 p-4 sm:col-span-2 xl:col-span-6">
            <p className="text-xs tracking-wide text-slate-400 uppercase">Next best action</p>
            <p className="mt-2 text-base font-semibold">
              {overview.topNextAction ?? "Not yet available"}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Uncertainty: {readableUncertainty(overview.uncertaintyIndicator)}
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function AskAutomateXEntry({ center }: { readonly center: PatronDecisionCenter }) {
  const suggestions = suggestedAskQuestions(center);
  return (
    <section aria-labelledby="ask-automatex">
      <Card className="border-blue-700/60 bg-gradient-to-br from-blue-950/70 to-slate-900/80 text-slate-50">
        <CardHeader>
          <Badge className="w-fit bg-blue-500/20 text-blue-100">Ask AutomateX</Badge>
          <CardTitle id="ask-automatex">Ask about this audit</CardTitle>
          <CardDescription className="text-slate-300">
            Grounded executive answers can use only this company&apos;s published decisions,
            evidence, uncertainty, economics and retained strategies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {center.status === "UNAVAILABLE" ? (
            <EmptyState text="Ask AutomateX becomes available after an ExecutiveDecisionView is published." />
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {suggestions.map((question) => (
                <div
                  key={question}
                  className="rounded-lg border border-blue-900/60 bg-slate-950/60 p-3 text-sm text-blue-100"
                >
                  {question}
                </div>
              ))}
            </div>
          )}
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
          <CardTitle id="executive-summary">Executive summary</CardTitle>
          <CardDescription className="text-slate-300">
            Generated from the authoritative executive decision view with deterministic fallback.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-base leading-7 text-slate-100">{center.executiveSummary}</p>
          {center.status === "UNAVAILABLE" ? (
            <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
              Analysis unavailable: no executive decisions are fabricated for this company.
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
          <h3 className="text-lg font-semibold">{card.title}</h3>
          <p className="mt-1 text-sm text-slate-300">{card.executiveSummary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className={decisionBadgeClass(card.decisionState)}>
            {readableDecisionState(card.decisionState)}
          </Badge>
          <Badge className="bg-slate-800 text-slate-100">{card.priority}</Badge>
          <Badge className="bg-blue-500/15 text-blue-200">
            Evidence: {readableEvidenceStrength(card.evidenceStrength)}
          </Badge>
        </div>
      </div>
      <dl className="mt-4 grid gap-3 md:grid-cols-2">
        <Info label="Why it matters" value={card.businessImpact} />
        <Info label="What to do now" value={card.whatToDoNow} />
        <Info label="Probable cause" value={card.probableCause} />
        <Info label="Economics" value={readableEconomicState(card.economicState)} />
      </dl>
      {card.whatNotToDo ? (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
          Do not: {card.whatNotToDo}
        </p>
      ) : null}
      <details className="mt-4 rounded-lg border border-slate-800 bg-slate-900/80 p-3">
        <summary className="cursor-pointer font-semibold text-blue-200">Why?</summary>
        <div className="mt-3 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
          <ListBlock title="Supporting evidence" items={card.evidenceReferences} />
          <ListBlock title="Unknowns and contradictions" items={card.uncertainty} />
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
          <CardTitle id="know-believe-unknown">
            What we know, believe, and don&apos;t know
          </CardTitle>
          <CardDescription className="text-slate-300">
            These are intentionally separated so assumptions never look like facts.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <ListBlock title="What we know" items={center.knowledge.whatWeKnow} />
          <ListBlock title="What we believe" items={center.knowledge.whatWeBelieve} />
          <ListBlock title="What we don't know" items={center.knowledge.whatWeDoNotKnow} />
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
          <CardTitle id="evidence-and-why">Evidence / Why?</CardTitle>
          <CardDescription className="text-slate-300">
            Source labels stay visible without exposing low-level internal IDs by default.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <ListBlock title="Supporting evidence" items={center.evidence.supportingSources} />
          <ListBlock title="Missing evidence" items={center.evidence.missingEvidence} />
          <ListBlock title="Conflicting evidence" items={center.evidence.conflictingSources} />
          <ListBlock title="Material contradictions" items={center.evidence.contradictions} />
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
          <CardTitle id="economics">Economics</CardTitle>
          <CardDescription className="text-slate-300">
            Only deterministic economic outputs are displayed.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Info label="Economic state" value={readableEconomicState(economics.state)} />
          <Info
            label="Benefit range"
            value={formatRange(economics.benefitRange, economics.currency)}
          />
          <Info label="Cost range" value={formatRange(economics.costRange, economics.currency)} />
          <Info label="Break-even" value={formatMonths(economics.breakEvenMonths)} />
          <Info label="Time to value" value={formatMonths(economics.timeToValueMonths)} />
          <Info
            label="Cost of inaction"
            value={formatMoney(economics.costOfInaction, economics.currency)}
          />
          <ListBlock title="Missing economic evidence" items={economics.missingEvidence} />
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
          <CardTitle id="next-best-actions">Next best actions</CardTitle>
          <CardDescription className="text-slate-300">
            Ranked from existing application outputs only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {center.nextActions.length ? (
            <ol className="space-y-3">
              {center.nextActions.map((action, index) => (
                <li key={`${action.category}:${action.label}`} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold">{action.label}</p>
                    <p className="text-sm text-slate-300">
                      {readableActionCategory(action.category)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState text="No next action is currently published." />
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

function ListBlock({
  title,
  items,
  empty = "Not yet available",
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
              {item}
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
  return state
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function readableEconomicState(state: string): string {
  if (state === "NOT_YET_AVAILABLE") return "Not yet available";
  return readableDecisionState(state);
}

function readableEvidenceStrength(strength: string): string {
  return strength.toLowerCase();
}

function readableUncertainty(value: string): string {
  if (value === "MATERIAL") return "material contradiction visible";
  if (value === "DECLARED") return "declared uncertainty";
  return "no declared uncertainty";
}

function readableActionCategory(category: string): string {
  return readableDecisionState(category);
}

function decisionBadgeClass(state: string): string {
  if (state === "AUTOMATE_NOW" || state === "AUTOMATE_CONDITIONALLY")
    return "bg-emerald-500/15 text-emerald-200";
  if (state === "FIX_BEFORE_AUTOMATING" || state === "INVESTIGATE_FIRST")
    return "bg-amber-500/15 text-amber-200";
  if (state === "DO_NOT_AUTOMATE" || state === "HUMAN_DECISION_REQUIRED")
    return "bg-red-500/15 text-red-200";
  return "bg-slate-800 text-slate-100";
}

function formatRange(range: readonly [number | null, number | null], currency: string | null) {
  if (range[0] === null && range[1] === null) return "Not yet available";
  if (range[0] === range[1]) return formatMoney(range[0], currency);
  return `${formatMoney(range[0], currency)} - ${formatMoney(range[1], currency)}`;
}

function formatMoney(value: number | null, currency: string | null) {
  if (value === null) return "Not yet available";
  return `${value.toLocaleString("en-US")} ${currency ?? ""}`.trim();
}

function formatMonths(value: number | null) {
  if (value === null) return "Not yet available";
  return `${value} months`;
}

function slug(value: string): string {
  return value.toLowerCase().replaceAll(" ", "-").replaceAll("/", "").replaceAll("?", "");
}

function suggestedAskQuestions(center: PatronDecisionCenter): readonly string[] {
  const questions = [
    "Why this recommendation?",
    "What evidence supports this?",
    "What is still uncertain?",
    "What should I fix first?",
    "What would change this decision?",
    center.doNotAutomate.length ? "Why should we not automate this?" : "What can we automate?",
    "What other options exist?",
  ];
  return Object.freeze(questions.slice(0, 6));
}
