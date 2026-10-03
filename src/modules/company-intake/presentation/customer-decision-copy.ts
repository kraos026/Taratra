import type {
  PatronDecisionCenter,
  PatronDecisionCard,
} from "../application/patron-decision-center";

const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export function readableDecisionState(state: string): string {
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
    NOT_ECONOMICALLY_JUSTIFIED: "Rentabilité non démontrée",
    READY: "Analyse publiée",
  };
  return labels[state] ?? "État à vérifier";
}

/** Translate known generated copy only. Never infer a decision, source content or a tool name. */
export function customerDecisionText(value: string): string {
  return value
    .replaceAll("AutomateX", "Optivos")
    .replaceAll("AUTOMATEX", "OPTIVOS")
    .replace(
      /Business impact [\d.]+; readiness [\d.]+; confidence [\d.]+\./g,
      "L’impact, la préparation et la confiance sont évalués par l’audit. Ces scores internes ne sont pas des gains financiers.",
    )
    .replace(
      /Do not automate before remediation\./g,
      "Ne pas automatiser avant d’avoir corrigé les points bloquants.",
    )
    .replace(
      /Do not manufacture missing ROI or process facts\./g,
      "Ne pas décider à partir de chiffres ou de faits non vérifiés.",
    )
    .replace(
      /Do not present this as a quick win\./g,
      "Ne pas présenter cette option comme un gain rapide : sa rentabilité n’est pas démontrée.",
    )
    .replace(/Do not remove the required human control\./g, "Conserver le contrôle humain requis.")
    .replace(
      /Approve a controlled automation design\./g,
      "Examiner et approuver une conception d’automatisation avec ses contrôles.",
    )
    .replace(
      /Proceed only after the listed conditions are addressed\./g,
      "Traiter les conditions indiquées avant de poursuivre.",
    )
    .replace(
      /Fix the process or data prerequisite before automation\./g,
      "Corriger le processus ou les données nécessaires avant d’automatiser.",
    )
    .replace(
      /Collect targeted evidence before deciding\./g,
      "Recueillir les preuves manquantes avant de décider.",
    )
    .replace(/Do not automate this item\./g, "Ne pas automatiser cette activité.")
    .replace(
      /Do not invest until economics change\./g,
      "Reporter l’investissement tant que les conditions économiques ne changent pas.",
    )
    .replace(
      /Keep the human decision\/control in place\./g,
      "Conserver la décision et le contrôle humains.",
    )
    .replace(/Provide the missing evidence\./g, "Compléter les preuves manquantes.")
    .replace(
      /Fix or validate this issue before automating: /g,
      "Corriger ou vérifier ce point avant d’automatiser : ",
    )
    .replace(/Review finding: /g, "Examiner le constat : ")
    .replace(/Published process map: /g, "Processus publié : ")
    .replace(
      / has a published automation audit result\./g,
      " dispose d’un résultat d’audit publié.",
    )
    .replace(/Finding: /g, "Constat : ")
    .replace(/Opportunity candidate: /g, "Piste d’automatisation à examiner : ")
    .replace(/Recommended initiative: /g, "Action proposée : ")
    .replace(
      /Published ROI evaluation is unavailable\./g,
      "L’évaluation économique publiée n’est pas disponible.",
    )
    .replace(
      /Some published ROI evaluations lack a supported return on investment\./g,
      "Certaines évaluations ne disposent pas d’un retour sur investissement vérifié.",
    )
    .replace(
      /Published recommendation portfolio is empty\./g,
      "Le plan d’action publié ne contient aucune proposition.",
    )
    .replace(
      /Published automation opportunities are empty\./g,
      "Aucune opportunité d’automatisation n’est publiée.",
    )
    .replace(
      /Some opportunities require stronger readiness or confidence evidence\./g,
      "Certaines opportunités nécessitent des preuves plus solides avant de poursuivre.",
    )
    .replace(
      /Do not automate controls or approvals without confirmed published evidence\./g,
      "Ne pas automatiser les contrôles ou les approbations sans preuves publiées et vérifiées.",
    )
    .replace(
      /Cause is derived from the published audit artifacts\./g,
      "Cause issue des éléments publiés de l’audit.",
    )
    .replace(
      /Complete the executive decision analysis first\./g,
      "Terminer l’analyse avant d’afficher les décisions.",
    )
    .replace(
      /A published ExecutiveDecisionView is required\./g,
      "Un résultat de décision publié est nécessaire.",
    )
    .replace(
      /The executive decision model has not been published for this company\./g,
      "Les décisions de cette entreprise ne sont pas encore publiées.",
    )
    .replace(
      /The analysis is incomplete\. Optivos needs more evidence before presenting an executive decision\./g,
      "L’analyse est incomplète. Des preuves supplémentaires sont nécessaires avant de présenter une décision.",
    )
    .replace(
      /The patron decision center is not available yet for this company\. Optivos will not invent executive decisions without a published ExecutiveDecisionView\./g,
      "Le centre de décision n’est pas encore disponible. Aucune conclusion ne sera inventée sans résultat publié.",
    )
    .replace(/Automate invoice processing/gi, "Automatiser le traitement des factures")
    .replace(/Invoice Processing/g, "Traitement des factures")
    .replace(/Email Processing/g, "Traitement des emails")
    .replace(/Scheduled Reporting/g, "Rapports périodiques")
    .replace(/Support Ticket Routing/g, "Orientation des demandes de support")
    .replace(/Database Synchronization/g, "Synchronisation des données")
    .replace(
      /Invoice processing contains manual work\./gi,
      "Le traitement des factures comporte des tâches manuelles.",
    )
    .replace(/Invoices are processed manually\./gi, "Les factures sont traitées manuellement.")
    .replace(/Automate scheduled reporting/gi, "Automatiser les rapports périodiques")
    .replace(/Automate email processing/gi, "Automatiser le traitement des emails")
    .replace(
      /Automate support ticket routing/gi,
      "Automatiser l’orientation des demandes de support",
    )
    .replace(
      /Reporting is missing or manual\./gi,
      "Les rapports sont absents ou préparés manuellement.",
    )
    .replace(
      /Operations depend on manual email handling\./gi,
      "L’activité dépend du traitement manuel des emails.",
    )
    .replace(
      /Support requests require manual routing\./gi,
      "Les demandes de support sont orientées manuellement.",
    )
    .replace(
      /([\d.]+)% of steps lack documentation\./gi,
      "$1 % des étapes ne disposent pas de documentation.",
    )
    .replace(
      /No KPI evidence is attached to the process\./gi,
      "Aucune preuve concernant les indicateurs de suivi n’est reliée au processus.",
    )
    .replace(/The process depends on email\./gi, "Le processus dépend des échanges par email.")
    .replace(/The process depends on Excel\./gi, "Le processus dépend de tableaux Excel.")
    .replace(/Missing documentation/gi, "Documentation manquante")
    .replace(/Missing KPI/gi, "Indicateurs de suivi manquants")
    .replace(/Email dependency/gi, "Dépendance aux emails")
    .replace(/Excel dependency/gi, "Dépendance aux tableaux Excel")
    .replace(/Document operating procedures\./gi, "Documenter les procédures de travail.")
    .replace(/Define a measurable KPI\./gi, "Définir un indicateur de suivi mesurable.")
    .replace(/Centralize workflow communication\./gi, "Centraliser les échanges liés au processus.")
    .replace(
      /Assess a governed business system\./gi,
      "Évaluer un outil métier avec les contrôles et responsabilités nécessaires.",
    )
    .replace(/Implement risk controls/gi, "Mettre en place les contrôles de risque")
    .replace(/Implement the automation opportunity/gi, "Préparer la mise en œuvre de l’opportunité")
    .replace(
      /Implement the governed AI-enabled initiative/gi,
      "Préparer l’initiative assistée par l’IA avec ses contrôles",
    )
    .replace(
      /Reduce repeatable invoice handling\./gi,
      "Réduire les tâches répétitives de traitement des factures.",
    )
    .replace(
      /Generate consistent scheduled reports\./gi,
      "Produire des rapports périodiques cohérents.",
    )
    .replace(
      /Route and process governed emails\./gi,
      "Orienter et traiter les emails selon les règles de contrôle.",
    )
    .replace(/Manual invoice processing/gi, "Traitement manuel des factures")
    .replace(
      /Route requests to the correct team\./gi,
      "Orienter les demandes vers l’équipe concernée.",
    )
    .replace(
      /Synchronize governed operational data\./gi,
      "Synchroniser les données opérationnelles selon les règles de contrôle.",
    )
    .replace(
      /Automate spreadsheet synchronization/gi,
      "Automatiser la synchronisation des tableaux",
    )
    .replace(/Data depends on spreadsheets\./gi, "Les données dépendent de tableaux de calcul.")
    .replace(/Invoice approval delay/gi, "Retard de validation des factures")
    .replace(/Manual invoice reconciliation/gi, "Rapprochement manuel des factures")
    .replace(/Invoice handling/gi, "Traitement des factures")
    .replace(/Decision center not published/g, "Décisions non publiées")
    .replace(uuidPattern, "référence interne non nommée");
}

/** A render-only copy: canonical states, original sourceView and all IDs remain untouched. */
export function customerDecisionCenter(center: PatronDecisionCenter): PatronDecisionCenter {
  const connections = new Map<string, string>();
  const allCopy = JSON.stringify(center);
  for (const match of allCopy.matchAll(/connecteur ([0-9a-f-]{36})/gi)) {
    const id = match[1]!.toLowerCase();
    if (!connections.has(id))
      connections.set(id, `connexion ${connections.size + 1} (nom non renseigné)`);
  }
  const text = (value: string) =>
    customerDecisionText(
      value
        .replace(
          /connecteur ([0-9a-f-]{36})/gi,
          (_, id: string) =>
            connections.get(id.toLowerCase()) ?? "connexion requise (nom non renseigné)",
        )
        .replace(/\ble connexion\b/g, "la connexion")
        .replace(/\bdu connexion\b/g, "de la connexion"),
    );
  const texts = (values: readonly string[]) => values.map(text);
  const referenceLabels = new Map<string, string>();
  const artifacts = center.sourceView?.traceability.executiveResultArtifactIds;
  for (const [key, label] of [
    ["processMapId", "Traçabilité : processus publié"],
    ["analysisId", "Traçabilité : analyse métier publiée"],
    ["automationOpportunitySnapshotId", "Traçabilité : dossier d’opportunités"],
    ["roiId", "Traçabilité : évaluation économique publiée"],
    ["recommendationPortfolioId", "Traçabilité : plan d’action publié"],
  ] as const) {
    const id = artifacts?.[key];
    if (id) referenceLabels.set(id, label);
  }
  const reference = (id: string) => {
    if (!referenceLabels.has(id))
      referenceLabels.set(
        id,
        `Référence enregistrée ${referenceLabels.size + 1} — contenu non détaillé`,
      );
    return referenceLabels.get(id)!;
  };
  const card = (value: PatronDecisionCard): PatronDecisionCard => ({
    ...value,
    title: text(value.title),
    executiveSummary: text(value.executiveSummary),
    businessImpact: text(value.businessImpact),
    probableCause: text(value.probableCause),
    whatToDoNow: text(value.whatToDoNow),
    whatNotToDo: value.whatNotToDo ? text(value.whatNotToDo) : null,
    uncertainty: texts(value.uncertainty),
    evidenceReferences: value.evidenceReferences.map(reference),
  });
  return {
    ...center,
    overview: {
      ...center.overview,
      companyName: text(center.overview.companyName),
      topNextAction: center.overview.topNextAction ? text(center.overview.topNextAction) : null,
    },
    executiveSummary: text(center.executiveSummary),
    topProblems: texts(center.topProblems),
    rootCausesOrHypotheses: texts(center.rootCausesOrHypotheses),
    bottlenecks: texts(center.bottlenecks),
    criticalIssues: texts(center.criticalIssues),
    priorityCards: center.priorityCards.map(card),
    fixBeforeAutomating: center.fixBeforeAutomating.map(card),
    automationOpportunities: center.automationOpportunities.map(card),
    doNotAutomate: center.doNotAutomate.map(card),
    knowledge: {
      whatWeKnow: texts(center.knowledge.whatWeKnow),
      whatWeBelieve: texts(center.knowledge.whatWeBelieve),
      whatWeDoNotKnow: texts(center.knowledge.whatWeDoNotKnow),
    },
    evidence: {
      supportingSources: center.evidence.supportingSources.map((item) =>
        /^[0-9a-f-]{36}$/i.test(item) ? reference(item) : text(item),
      ),
      conflictingSources: center.evidence.conflictingSources.map((item) =>
        /^[0-9a-f-]{36}$/i.test(item) ? reference(item) : text(item),
      ),
      missingEvidence: texts(center.evidence.missingEvidence),
      contradictions: texts(center.evidence.contradictions),
    },
    economics: { ...center.economics, missingEvidence: texts(center.economics.missingEvidence) },
    nextActions: center.nextActions.map((action) => ({ ...action, label: text(action.label) })),
  };
}
