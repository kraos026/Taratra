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
    .replaceAll("Human bottleneck", "Dépendance à une personne")
    .replaceAll("Single point of failure", "Point de dépendance unique")
    .replace(
      /(.+?) performs ([\d.]+)% of manual steps\./g,
      "$1 réalise $2 % des étapes manuelles du modèle.",
    )
    .replace(
      /(.+?) carries ([\d.]+)% of manual duration\./g,
      "$1 concentre $2 % de la durée manuelle du modèle.",
    )
    .replaceAll(
      "Add coverage and delegation.",
      "Prévoir un relais et définir les responsabilités déléguées.",
    )
    .replaceAll(
      "Redistribute or automate the bottleneck.",
      "Examiner la répartition du travail et les tâches pouvant être assistées, sans retirer les contrôles humains.",
    )
    .replaceAll(
      "Assess a governed system.",
      "Évaluer un outil avec des responsabilités et des contrôles définis.",
    )
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
