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

/** Readiness is a server gate, not a guarantee that every answer is reliable. */
export function interviewReviewSummary(
  questions: { id: string; code: string }[],
  answers: { questionId: string; value: unknown; confidence: string }[],
  progress: { missingMandatory: string[]; readyForProcessMapping: boolean },
) {
  const byQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));
  const pending = questions.filter((question) => {
    const answer = byQuestion.get(question.id);
    return (
      progress.missingMandatory.includes(question.code) ||
      (answer && (answer.value == null || !["confirmed", "validated"].includes(answer.confidence)))
    );
  });
  const pendingCount = pending.length;
  const message = progress.readyForProcessMapping
    ? "Les critères de passage à la suite sont remplis. Cela ne garantit pas l’exactitude de chaque réponse."
    : progress.missingMandatory.length > 0
      ? `${progress.missingMandatory.length} information(s) obligatoire(s) restent à renseigner.`
      : "Les réponses obligatoires sont renseignées, mais le seuil de confiance requis pour poursuivre n’est pas atteint.";
  return { pendingCount, message };
}

export function interviewConfidenceLabel(value: unknown, confidence: string): string {
  if (value == null || confidence === "missing") return "Information non renseignée";
  if (confidence === "validated") return "Réponse validée";
  if (confidence === "confirmed") return "Réponse déclarée confirmée";
  return "Réponse incertaine · à confirmer";
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
