// Only the actor reference used by the canonical explanation is resolved, not relatedActorId.
const actorStatement =
  /\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}) (performs|carries) ([\d.]+)% of manual (steps|duration)\./gi;

export function publishedActorReferences(description: string): string[] {
  return [...description.matchAll(new RegExp(actorStatement))]
    .filter(
      (match) =>
        (match[2] === "performs" && match[4] === "steps") ||
        (match[2] === "carries" && match[4] === "duration"),
    )
    .map((match) => match[1].toLowerCase());
}

export function publishedActorDescription(
  description: string,
  labels: ReadonlyMap<string, string>,
): string {
  return description.replace(
    new RegExp(actorStatement),
    (statement, id: string, verb: string, share: string, unit: string) => {
      if (!(
        (verb === "performs" && unit === "steps") ||
        (verb === "carries" && unit === "duration")
      ))
        return statement;
      const label = labels.get(id.toLowerCase())?.trim();
      const source = label
        ? `la référence de responsable « ${label} », issue des connaissances publiées utilisées pour décrire le processus`
        : "une même référence de responsable dont le libellé est inconnu";
      const measure = unit === "steps" ? "des étapes manuelles" : "de la durée manuelle";
      return `Dans le modèle publié, la part ${measure} attribuée à ${source} est de ${share} %. L’identité du responsable et la répartition réelle du travail restent à vérifier ; ce pourcentage ne mesure pas sa charge de travail réelle.`;
    },
  );
}
