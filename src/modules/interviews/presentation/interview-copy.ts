/** Display-only labels. Question codes and submitted answer values are unchanged. */
export function interviewDomainLabel(domain: string): string {
  return (
    (
      {
        company: "Entreprise",
        operations: "Activité",
        finance: "Finances",
        software: "Outils",
        hr: "Équipe",
      } as Record<string, string>
    )[domain] ?? "Votre activité"
  );
}

export function isInterviewReadOnly(status: string): boolean {
  return status === "validated" || status === "archived";
}

export function interviewAnswerLabel(value: unknown): string {
  if (value === null) return "Sans réponse";
  if (value === true) return "Oui";
  if (value === false) return "Non";
  return String(value);
}
