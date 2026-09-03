import type {
  AssistedAuditReadModel,
  AssistedAuditStage,
  AssistedAuditStageStatus,
} from "../application/assisted-audit-model";

export type CustomerJourneyStep = {
  readonly key:
    "UNDERSTANDING" | "PROCESS" | "ANALYSIS" | "AUTOMATION" | "ROI" | "PLAN" | "RESULTS";
  readonly label: string;
  readonly description: string;
  readonly stages: readonly AssistedAuditStage[];
  readonly status: AssistedAuditStageStatus;
  readonly current: boolean;
};

export type CustomerJourneyRoutes = {
  readonly audit: string;
  readonly opportunities: string;
  readonly roi: string;
  readonly actionPlan: string;
  readonly results: string;
};

const definitions = [
  {
    key: "UNDERSTANDING",
    label: "Compréhension",
    description: "Entreprise, découverte, entretien et synthèse des preuves.",
    stages: ["DISCOVERY", "INTERVIEW", "KNOWLEDGE"],
  },
  {
    key: "PROCESS",
    label: "Processus",
    description: "Cartographie du travail réellement observé.",
    stages: ["PROCESS_MAP"],
  },
  {
    key: "ANALYSIS",
    label: "Analyse",
    description: "Frictions, risques et opportunités assistées par l’IA.",
    stages: ["BUSINESS_ANALYSIS", "AI_OPPORTUNITIES"],
  },
  {
    key: "AUTOMATION",
    label: "Automatisation",
    description: "Pistes réalistes, connecteurs et contrôles humains.",
    stages: ["AUTOMATION_OPPORTUNITIES"],
  },
  {
    key: "ROI",
    label: "ROI",
    description: "Impact calculé seulement quand les preuves le permettent.",
    stages: ["ROI"],
  },
  {
    key: "PLAN",
    label: "Plan d’action",
    description: "Priorités, conditions, risques et prochaine décision.",
    stages: ["RECOMMENDATIONS"],
  },
  {
    key: "RESULTS",
    label: "Résultats",
    description: "Synthèse finale disponible quand l’audit est complet.",
    stages: ["COMPLETED"],
  },
] as const satisfies readonly Omit<CustomerJourneyStep, "status" | "current">[];

export function buildCustomerJourney(model: AssistedAuditReadModel): CustomerJourneyStep[] {
  const byStage = new Map(model.stages.map((stage) => [stage.stage, stage.status]));
  const currentDefinitionIndex = definitions.findIndex((definition) =>
    definition.stages.some((stage) => stage === model.currentStage),
  );

  return definitions.map((definition, definitionIndex) => {
    const current = definition.stages.some((stage) => stage === model.currentStage);
    const future = currentDefinitionIndex >= 0 && definitionIndex > currentDefinitionIndex;
    return {
      ...definition,
      status:
        definition.key === "RESULTS" && model.currentStage === "COMPLETED"
          ? "COMPLETED"
          : future
            ? "NOT_STARTED"
            : current
              ? (byStage.get(model.currentStage) ?? "NOT_STARTED")
              : combineStageStatuses(definition.stages.map((stage) => byStage.get(stage))),
      current,
    };
  });
}

export function journeyProgress(model: AssistedAuditReadModel): number {
  if (model.currentStage === "COMPLETED") return 100;
  const engineStages = model.stages.filter((stage) => stage.stage !== "COMPLETED");
  const completed = engineStages.filter((stage) => stage.status === "COMPLETED").length;
  return Math.round((completed / Math.max(engineStages.length, 1)) * 100);
}

export function currentJourneyLabel(model: AssistedAuditReadModel): string {
  return buildCustomerJourney(model).find((step) => step.current)?.label ?? "Résultats";
}

export function customerStageLabel(stage: AssistedAuditStage): string {
  const labels: Record<AssistedAuditStage, string> = {
    DISCOVERY: "Compréhension de l’entreprise",
    INTERVIEW: "Entretien opérationnel",
    KNOWLEDGE: "Synthèse des preuves",
    PROCESS_MAP: "Cartographie des processus",
    BUSINESS_ANALYSIS: "Analyse métier",
    AI_OPPORTUNITIES: "Opportunités assistées par l’IA",
    AUTOMATION_OPPORTUNITIES: "Opportunités d’automatisation",
    ROI: "Évaluation du ROI",
    RECOMMENDATIONS: "Plan d’action",
    COMPLETED: "Résultats disponibles",
  };
  return labels[stage];
}

export function customerStatusLabel(status: AssistedAuditStageStatus): string {
  const labels: Record<AssistedAuditStageStatus, string> = {
    NOT_STARTED: "À venir",
    IN_PROGRESS: "En cours",
    READY_FOR_REVIEW: "À valider",
    READY_TO_PUBLISH: "Prêt à publier",
    COMPLETED: "Terminé",
    BLOCKED: "Informations requises",
    AMBIGUOUS: "Choix requis",
  };
  return labels[status];
}

export function customerJourneyRoutes(
  companyId: string,
  model: AssistedAuditReadModel | null | undefined,
): CustomerJourneyRoutes {
  const audit = `/companies/${companyId}/automation-audit`;
  if (!model) return { audit, opportunities: audit, roi: audit, actionPlan: audit, results: audit };

  const publishedArtifact = (stage: AssistedAuditStage) => {
    const artifact = model.stages.find((item) => item.stage === stage)?.artifact;
    return artifact?.status === "published" ? artifact : null;
  };
  const opportunity = publishedArtifact("AUTOMATION_OPPORTUNITIES");
  const roi = publishedArtifact("ROI");
  const recommendations = publishedArtifact("RECOMMENDATIONS");

  return {
    audit,
    opportunities: opportunity ? `/automation-opportunities/${opportunity.id}` : audit,
    roi: roi ? `/roi/${roi.id}` : audit,
    actionPlan: recommendations ? `/recommendations/${recommendations.id}` : audit,
    results:
      model.currentStage === "COMPLETED"
        ? `/companies/${companyId}/automation-audit/results`
        : audit,
  };
}

function combineStageStatuses(
  statuses: readonly (AssistedAuditStageStatus | undefined)[],
): AssistedAuditStageStatus {
  if (statuses.some((status) => status === "AMBIGUOUS")) return "AMBIGUOUS";
  if (statuses.some((status) => status === "BLOCKED")) return "BLOCKED";
  if (statuses.length > 0 && statuses.every((status) => status === "COMPLETED")) return "COMPLETED";
  if (statuses.some((status) => status === "READY_TO_PUBLISH")) return "READY_TO_PUBLISH";
  if (statuses.some((status) => status === "READY_FOR_REVIEW")) return "READY_FOR_REVIEW";
  if (statuses.some((status) => status === "IN_PROGRESS")) return "IN_PROGRESS";
  return "NOT_STARTED";
}
