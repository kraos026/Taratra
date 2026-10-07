import { customerDecisionText } from "@/modules/company-intake/presentation/customer-decision-copy";

/** Presentation only: never changes stored scores, evidence, statuses or decisions. */
export function auditLabel(value: string): string {
  const labels: Record<string, string> = {
    draft: "Brouillon",
    validated: "Validé",
    published: "Publié",
    archived: "Archivé",
    error: "Point bloquant",
    warning: "À vérifier",
    information: "Information",
    critical: "Critique",
    high: "Élevé",
    medium: "Modéré",
    low: "Faible",
    step: "Étape",
    decision: "Point de décision",
    event: "Déclencheur",
    output: "Résultat",
    input: "Entrée",
    manual: "Manuel",
    mixed: "Mixte",
    automatic: "Automatique",
    automated: "Automatisé",
    daily: "Chaque jour",
    weekly: "Chaque semaine",
    monthly: "Chaque mois",
    yearly: "Chaque année",
    annually: "Chaque année",
    hourly: "Chaque heure",
    ad_hoc: "Selon les besoins",
    organization_health: "Organisation",
    department_health: "Équipes",
    process_health: "Processus",
    system_health: "Outils",
    documentation_health: "Documentation",
    ownership_health: "Responsabilités",
    automation_readiness: "Préparation à l’automatisation",
    ai_readiness: "Préparation aux usages IA",
    "Process Quality": "Qualité du processus",
    "Manual Work": "Travail manuel",
    "Operational Risk": "Risque opérationnel",
    Documentation: "Documentation",
    Digitalization: "Usage des outils numériques",
    "Automation Potential": "Potentiel d’automatisation",
    "AI Potential": "Potentiel des usages IA",
    "Data Quality": "Qualité des données",
    Ownership: "Responsabilités",
    risk: "Risque",
    efficiency: "Efficacité",
    systems: "Outils",
    documentation: "Documentation",
    measurement: "Indicateurs de suivi",
    organization: "Organisation",
  };
  return labels[value] ?? labels[value.toLowerCase()] ?? customerDecisionText(value);
}

export function auditText(value: string): string {
  return customerDecisionText(value)
    .replaceAll(
      "Graph validation passed",
      "Les contrôles de structure du processus sont satisfaits.",
    )
    .replaceAll(
      "Analysis validation passed",
      "Les contrôles de validation de l’analyse sont satisfaits.",
    );
}

export function analysisValidationCopy(code: string): string {
  const messages: Record<string, string> = {
    source_descriptions_incomplete:
      "Des descriptions d’étapes ne sont pas renseignées dans la cartographie. Cela ne prouve pas l’absence de procédures dans l’entreprise. Cette lacune ne crée ni risque chiffré ni opportunité ; les constats prouvés peuvent être examinés séparément.",
    source_indicators_not_documented:
      "Les indicateurs de suivi ne sont pas documentés dans les sources analysées. Leur existence et leurs valeurs restent inconnues. Aucun reporting, gain ou indicateur n’est inventé ; les décisions restent soumises à leurs propres preuves et hypothèses économiques.",
    missing_evidence:
      "Au moins un constat n’a pas de preuve pertinente reliée. Consultez les constats sans référence source, vérifiez les informations de l’entreprise et de l’entretien, puis faites reconstruire l’analyse à partir de sources complétées. Ne validez pas une information simplement pour débloquer l’audit.",
    source_not_published:
      "Le processus source doit être examiné et publié avant de valider l’analyse.",
    missing_score_trace:
      "Un score ne dispose pas de formule traçable. L’analyse doit être reconstruite et vérifiée avant validation.",
    unresolved_explanation:
      "Une explication reste incomplète. Elle doit être corrigée avant validation.",
    analysis_valid:
      "Les contrôles de cette analyse sont satisfaits. Cela ne garantit ni la rentabilité ni la sécurité d’une automatisation.",
  };
  return (
    messages[code] ??
    "Un contrôle supplémentaire est signalé dans cette analyse. Faites examiner ce point avant de poursuivre ; aucune preuve ne sera ajoutée automatiquement."
  );
}
