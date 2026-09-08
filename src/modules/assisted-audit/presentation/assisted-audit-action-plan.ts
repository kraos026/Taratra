import type {
  AssistedAuditAction,
  AssistedAuditArtifactReference,
  AssistedAuditReadModel,
  AssistedAuditStage,
} from "../application/assisted-audit-model";

export interface AuditCommandRequest {
  url: string;
  init: RequestInit;
}

export type AuditActionPresentation =
  | { kind: "navigate"; label: string; description: string; href: string }
  | { kind: "command"; label: string; description: string; request: AuditCommandRequest }
  | { kind: "unavailable"; label: string; description: string };

const copy: Record<AssistedAuditAction, { label: string; description: string }> = {
  START_DISCOVERY: {
    label: "Décrire mon entreprise",
    description:
      "Décrivez votre activité avec ce que vous savez. Vous pourrez enregistrer et reprendre plus tard.",
  },
  CONTINUE_DISCOVERY: {
    label: "Reprendre mes réponses",
    description: "Complétez les informations sur votre activité, vos priorités et vos difficultés.",
  },
  VALIDATE_DISCOVERY: {
    label: "Confirmer mes informations",
    description: "Relisez vos réponses et confirmez qu’elles décrivent bien votre entreprise.",
  },
  START_INTERVIEW: {
    label: "Préciser mon quotidien",
    description: "Répondez aux questions utiles sur vos tâches et votre organisation.",
  },
  CONTINUE_INTERVIEW: {
    label: "Continuer l’entretien",
    description: "Complétez les dernières questions sur votre travail quotidien.",
  },
  VALIDATE_INTERVIEW: {
    label: "Confirmer mes réponses",
    description: "Vérifiez les réponses de l’entretien avant de lancer leur analyse.",
  },
  BUILD_KNOWLEDGE: {
    label: "Préparer la synthèse",
    description: "Optivos rassemble vos informations confirmées pour préparer l’analyse.",
  },
  BUILD_PROCESS_MAP: {
    label: "Décrire les processus",
    description:
      "Optivos structure les activités et les enchaînements de travail à partir de vos informations.",
  },
  SELECT_PROCESS_MAP: {
    label: "Choisir un processus",
    description: "Choisissez le processus à analyser en premier.",
  },
  VALIDATE_PROCESS_MAP: {
    label: "Vérifier le processus",
    description: "Examinez les étapes du processus sélectionné et validez leur cohérence.",
  },
  PUBLISH_PROCESS_MAP: {
    label: "Approuver le processus",
    description: "Votre approbation rend ce processus disponible pour l’analyse.",
  },
  GENERATE_ANALYSIS: {
    label: "Analyser le processus",
    description: "Repérez les difficultés, les risques et les possibilités d’amélioration.",
  },
  VALIDATE_ANALYSIS: {
    label: "Vérifier l’analyse",
    description: "Examinez les constats issus de votre processus.",
  },
  PUBLISH_ANALYSIS: {
    label: "Approuver l’analyse",
    description: "Confirmez les constats avant de rechercher les possibilités d’automatisation.",
  },
  GENERATE_AI_OPPORTUNITIES: {
    label: "Explorer les usages de l’IA",
    description:
      "Identifiez les tâches pour lesquelles une assistance par l’IA pourrait être pertinente.",
  },
  VALIDATE_AI_OPPORTUNITIES: {
    label: "Vérifier les usages proposés",
    description: "Examinez les propositions et les informations qui les soutiennent.",
  },
  PUBLISH_AI_OPPORTUNITIES: {
    label: "Approuver les usages proposés",
    description:
      "Confirmez les propositions à utiliser pour évaluer les possibilités d’automatisation.",
  },
  GENERATE_AUTOMATION_OPPORTUNITIES: {
    label: "Identifier les automatisations",
    description: "Évaluez les possibilités d’automatisation à partir des constats approuvés.",
  },
  VALIDATE_AUTOMATION_OPPORTUNITIES: {
    label: "Vérifier les automatisations",
    description: "Examinez les possibilités, leurs contraintes et les preuves disponibles.",
  },
  PUBLISH_AUTOMATION_OPPORTUNITIES: {
    label: "Approuver les propositions",
    description: "Confirmez les possibilités à évaluer économiquement. Rien n’est déployé.",
  },
  ENTER_ROI_ASSUMPTIONS: {
    label: "Préciser les hypothèses économiques",
    description: "Renseignez les coûts et les volumes connus pour permettre l’évaluation du ROI.",
  },
  VALIDATE_ROI: {
    label: "Vérifier l’évaluation économique",
    description: "Examinez les scénarios, les hypothèses et les informations encore manquantes.",
  },
  PUBLISH_ROI: {
    label: "Approuver l’évaluation économique",
    description: "Confirmez les scénarios avant de préparer le plan d’action.",
  },
  GENERATE_RECOMMENDATIONS: {
    label: "Préparer le plan d’action",
    description: "Organisez les propositions approuvées en priorités et prochaines étapes.",
  },
  VALIDATE_RECOMMENDATIONS: {
    label: "Vérifier le plan d’action",
    description: "Examinez les priorités recommandées et les conditions de mise en œuvre.",
  },
  PUBLISH_RECOMMENDATIONS: {
    label: "Approuver le plan d’action",
    description: "Confirmez le plan proposé pour terminer cette étape de l’audit.",
  },
  VIEW_RESULTS: {
    label: "Voir les résultats",
    description:
      "Consultez vos priorités, votre plan d’action et les éléments qui justifient les décisions.",
  },
};

export function presentNextAction(
  model: AssistedAuditReadModel,
  companyId: string,
): AuditActionPresentation | null {
  const action = model.nextAction;
  if (!action) return null;
  const text = copy[action];
  if (action === "START_DISCOVERY" || action === "CONTINUE_DISCOVERY")
    return { kind: "navigate", ...text, href: `/companies/${companyId}/discovery` };
  if (action === "START_INTERVIEW" || action === "CONTINUE_INTERVIEW")
    return { kind: "navigate", ...text, href: `/companies/${companyId}/interview` };
  if (action === "VIEW_RESULTS") {
    return artifact(model, "RECOMMENDATIONS")
      ? { kind: "navigate", ...text, href: `/companies/${companyId}/automation-audit/results` }
      : { kind: "unavailable", ...text };
  }
  if (action === "SELECT_PROCESS_MAP") return { kind: "unavailable", ...text };
  if (action === "ENTER_ROI_ASSUMPTIONS") {
    const opportunity = artifact(model, "AUTOMATION_OPPORTUNITIES");
    const roi = artifact(model, "ROI");
    return opportunity
      ? {
          kind: "navigate",
          ...text,
          href: `/companies/${companyId}/automation-audit/roi/${opportunity.id}${roi ? `?roiId=${roi.id}` : ""}`,
        }
      : { kind: "unavailable", ...text };
  }
  const request = commandFor(action, model, companyId);
  return request ? { kind: "command", ...text, request } : { kind: "unavailable", ...text };
}

export function presentProcessCandidateAction(
  candidate: AssistedAuditArtifactReference,
): AuditActionPresentation {
  const detail = `/process-maps/${candidate.id}`;
  if (candidate.status === "draft")
    return {
      kind: "command",
      label: "Validate this process",
      description: "Validate this candidate before approving it.",
      request: post(`/api/process-maps/${candidate.id}/validate`, candidate.lockVersion),
    };
  if (candidate.status === "validated")
    return {
      kind: "command",
      label: "Approve this process",
      description: "Approve this candidate before selecting it for analysis.",
      request: post(`/api/process-maps/${candidate.id}/publish`, candidate.lockVersion),
    };
  if (candidate.status === "published")
    return {
      kind: "command",
      label: "Analyze this process",
      description: "This explicit analysis selects the process for the audit.",
      request: post(`/api/process-maps/${candidate.id}/analyze`),
    };
  return {
    kind: "navigate",
    label: "Review this process",
    description: "Open the process details.",
    href: detail,
  };
}

export async function performAuditCommand(
  request: AuditCommandRequest,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const response = await fetcher(request.url, request.init);
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  if (!response.ok)
    throw new Error(payload?.error?.message ?? "This action could not be completed.");
}

export async function performAuditCommandAndRefresh(
  request: AuditCommandRequest,
  refresh: () => Promise<void>,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await performAuditCommand(request, fetcher);
  await refresh();
}

export function createActionLock() {
  let locked = false;
  return {
    acquire() {
      if (locked) return false;
      locked = true;
      return true;
    },
    release() {
      locked = false;
    },
  };
}

function commandFor(
  action: AssistedAuditAction,
  model: AssistedAuditReadModel,
  companyId: string,
): AuditCommandRequest | null {
  const current = model.stages.find((stage) => stage.stage === model.currentStage)?.artifact;
  const endpoints: Partial<Record<AssistedAuditAction, string>> = {
    VALIDATE_DISCOVERY: current ? `/api/discovery-sessions/${current.id}/validate` : undefined,
    VALIDATE_INTERVIEW: current ? `/api/interviews/${current.id}/validate` : undefined,
    BUILD_KNOWLEDGE: `/api/companies/${companyId}/knowledge-snapshots`,
    BUILD_PROCESS_MAP: artifact(model, "KNOWLEDGE")
      ? `/api/knowledge-snapshots/${artifact(model, "KNOWLEDGE")!.id}/process-maps`
      : undefined,
    VALIDATE_PROCESS_MAP: current ? `/api/process-maps/${current.id}/validate` : undefined,
    PUBLISH_PROCESS_MAP: current ? `/api/process-maps/${current.id}/publish` : undefined,
    GENERATE_ANALYSIS: artifact(model, "PROCESS_MAP")
      ? `/api/process-maps/${artifact(model, "PROCESS_MAP")!.id}/analyze`
      : undefined,
    VALIDATE_ANALYSIS: current ? `/api/analysis/${current.id}/validate` : undefined,
    PUBLISH_ANALYSIS: current ? `/api/analysis/${current.id}/publish` : undefined,
    GENERATE_AI_OPPORTUNITIES: artifact(model, "BUSINESS_ANALYSIS")
      ? `/api/business-analysis/${artifact(model, "BUSINESS_ANALYSIS")!.id}/ai-opportunities`
      : undefined,
    VALIDATE_AI_OPPORTUNITIES: current ? `/api/ai-opportunities/${current.id}/validate` : undefined,
    PUBLISH_AI_OPPORTUNITIES: current ? `/api/ai-opportunities/${current.id}/publish` : undefined,
    GENERATE_AUTOMATION_OPPORTUNITIES: artifact(model, "AI_OPPORTUNITIES")
      ? `/api/ai-opportunities/${artifact(model, "AI_OPPORTUNITIES")!.id}/automation-opportunities`
      : undefined,
    VALIDATE_AUTOMATION_OPPORTUNITIES: current
      ? `/api/automation-opportunities/${current.id}/validate`
      : undefined,
    PUBLISH_AUTOMATION_OPPORTUNITIES: current
      ? `/api/automation-opportunities/${current.id}/publish`
      : undefined,
    VALIDATE_ROI: current ? `/api/roi/${current.id}/validate` : undefined,
    PUBLISH_ROI: current ? `/api/roi/${current.id}/publish` : undefined,
    GENERATE_RECOMMENDATIONS: artifact(model, "ROI")
      ? `/api/roi/${artifact(model, "ROI")!.id}/recommendations`
      : undefined,
    VALIDATE_RECOMMENDATIONS: current ? `/api/recommendations/${current.id}/validate` : undefined,
    PUBLISH_RECOMMENDATIONS: current ? `/api/recommendations/${current.id}/publish` : undefined,
  };
  const url = endpoints[action];
  if (!url) return null;
  return post(url, mutationNeedsLock(action) ? current?.lockVersion : undefined);
}

function mutationNeedsLock(action: AssistedAuditAction): boolean {
  return action.startsWith("VALIDATE_") || action.startsWith("PUBLISH_");
}

function post(url: string, lockVersion?: number): AuditCommandRequest {
  const hasBody = lockVersion !== undefined;
  return {
    url,
    init: {
      method: "POST",
      ...(hasBody
        ? {
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ lockVersion }),
          }
        : {}),
    },
  };
}

function artifact(model: AssistedAuditReadModel, stage: AssistedAuditStage) {
  return model.stages.find((candidate) => candidate.stage === stage)?.artifact ?? null;
}
