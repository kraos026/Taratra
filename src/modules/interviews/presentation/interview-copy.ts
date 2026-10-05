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

const choiceLabels: Record<string, Record<string, string>> = {
  "operations.order_channels": {
    email: "E-mail",
    telephone: "Téléphone",
    website: "Site internet",
    in_person: "En personne",
    marketplace: "Place de marché",
    other: "Autre",
  },
  "finance.invoice_mode": {
    manual: "Manuel",
    mixed: "Partiellement automatisé",
    automatic: "Automatique",
  },
};

export function interviewChoiceLabel(code: string, value: string): string {
  return choiceLabels[code]?.[value] ?? value;
}

export function interviewErrorLabel(message: string): string {
  if (
    message === "A validated Discovery is required to start an interview" ||
    message === "A validated Discovery is required to view an interview"
  )
    return "Validez d’abord les informations de votre entreprise avant de démarrer ou consulter l’entretien.";
  return message;
}

export function interviewAnswerLabel(
  value: unknown,
  question?: { code: string; answerType: string },
): string {
  if (value === null) return "Sans réponse";
  if (value === true) return "Oui";
  if (value === false) return "Non";
  if (question?.answerType === "single_choice" && typeof value === "string")
    return interviewChoiceLabel(question.code, value);
  if (question?.answerType === "multiple_choice" && Array.isArray(value))
    return value.map((item) => interviewChoiceLabel(question.code, String(item))).join(", ");
  return String(value);
}
