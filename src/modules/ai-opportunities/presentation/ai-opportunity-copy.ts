/** Translate known catalogue text only; never invent facts or change stored scores. */
export function aiOpportunityText(value: string) {
  const catalogue: Record<string, string> = {
    "Invoice intelligence": "Assister le traitement des factures",
    "Email triage": "Assister le classement des emails",
    "Spreadsheet intelligence": "Examiner les données des tableaux Excel",
    "Invoices are processed manually.": "Les factures sont traitées manuellement.",
    "Reduce manual extraction and re-entry.":
      "Étudier l’extraction des informations et la réduction de la ressaisie, avec validation humaine.",
    "Operational work depends on email.": "Le travail repose sur les échanges par email.",
    "Classify and route incoming messages.":
      "Étudier le classement et l’orientation des messages entrants, sans présumer l’existence d’un service support.",
    "Decision work depends on spreadsheets.":
      "Les données de travail sont gérées dans des tableaux.",
    "Forecast and suggest options from governed history.":
      "Examiner si un historique fiable permet des prévisions ou une aide à la décision. Sans cet historique, aucune prévision n’est établie.",
    OCR: "Lecture de documents (OCR)",
    "Information Extraction": "Extraction d’informations",
    Forecasting: "Prévisions à étudier",
    "Recommendation Systems": "Aide à la décision",
    "Email Classification": "Classement des emails",
  };
  return catalogue[value] ?? value;
}
