import Link from "next/link";
import type { PatronDecisionCenter } from "../application/patron-decision-center";
import { customerDecisionText, readableDecisionState } from "./customer-decision-copy";

const priorities: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

/** Read-only summary of the existing projection, never a new decision or economic ranking. */
export function DecisionBrief({ center }: { readonly center: PatronDecisionCenter }) {
  if (
    center.source !== "EXECUTIVE_DECISION_VIEW" ||
    !center.sourceView ||
    center.status === "UNAVAILABLE" ||
    center.status === "ANALYSIS_INCOMPLETE"
  )
    return null;
  const first = center.priorityCards.reduce<(typeof center.priorityCards)[number] | undefined>(
    (selected, card) =>
      !selected || (priorities[card.priority] ?? 0) > (priorities[selected.priority] ?? 0)
        ? card
        : selected,
    undefined,
  );
  if (!first) return null;
  const source = center.sourceView.priorityCards.find((card) => card.id === first.sourceCardId);
  if (!source) return null;
  const artifacts = source.traceability.executiveResultArtifactIds;
  const evidenceLinks = [
    { id: artifacts.processMapId, path: "process-maps", label: "Revoir le processus source" },
    { id: artifacts.analysisId, path: "analysis", label: "Revoir les constats et leurs preuves" },
  ].filter((link) => link.id);
  return (
    <section
      aria-labelledby="decision-brief-title"
      className="rounded-3xl border border-blue-400/25 bg-blue-950/30 p-5 sm:p-7"
    >
      <p className="text-xs font-bold tracking-wide text-blue-200 uppercase">
        L’essentiel pour décider
      </p>
      <h2 id="decision-brief-title" className="mt-2 text-xl font-bold text-white">
        {first.title}
      </h2>
      <p className="mt-2 font-semibold text-amber-100">
        {readableDecisionState(first.decisionState)}
      </p>
      <p className="mt-2 text-xs text-slate-400">
        Premier point selon la priorité publiée ; en cas d’égalité, l’ordre du dossier est conservé.
        Ce n’est pas un classement des gains.
      </p>
      <dl className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <dt className="font-semibold text-blue-200">Pourquoi examiner ce point ?</dt>
          <dd className="mt-2 text-sm leading-6 text-slate-200">
            {customerDecisionText(source.problem) ||
              "Le constat doit être précisé dans les sources."}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-blue-200">Votre prochaine action</dt>
          <dd className="mt-2 text-sm leading-6 text-slate-200">{first.whatToDoNow}</dd>
        </div>
        <div>
          <dt className="font-semibold text-blue-200">Ce qui reste à vérifier</dt>
          <dd className="mt-2 text-sm leading-6 text-slate-200">
            {first.uncertainty.length ? (
              <ul className="list-disc space-y-1 pl-5">
                {first.uncertainty.slice(0, 3).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              "Aucune incertitude enregistrée pour ce point ; cela ne garantit pas l’absence de risque."
            )}
            {first.uncertainty.length > 3 && (
              <p className="mt-2">
                {first.uncertainty.length - 3} autre(s) point(s) à examiner dans le détail des
                décisions.
              </p>
            )}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-blue-200">Limite à respecter</dt>
          <dd className="mt-2 text-sm leading-6 text-slate-200">
            {first.whatNotToDo ??
              "Examiner les preuves et valider les conditions avant toute mise en œuvre."}
          </dd>
        </div>
      </dl>
      <div className="mt-5 flex flex-wrap gap-4">
        {evidenceLinks.map((link) => (
          <Link
            key={link.path}
            href={`/${link.path}/${link.id}`}
            className="text-sm font-semibold text-blue-200 underline underline-offset-4"
          >
            {link.label}
          </Link>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-400">
        Ces liens permettent d’examiner les sources, pas de prouver à eux seuls la qualité du
        constat. Les montants restent des estimations ; aucune automatisation n’est déployée.
      </p>
    </section>
  );
}
