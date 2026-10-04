import type { AskAutomateXResponse } from "./ask-automatex";

// Educational copy is application-owned. A model can select it, never rewrite it.
export const auditExplanationTopics = {
  EVIDENCE:
    "Une preuve doit concerner cette piste précise. Une donnée manquante reste inconnue ; elle ne devient ni zéro ni un fait démontré.",
  ECONOMICS:
    "Le ROI est une estimation issue des hypothèses renseignées. Le temps total d’une tâche n’est pas automatiquement économisable et un gain estimé n’est pas garanti.",
  HUMAN_CONTROL:
    "Une piste ne constitue pas une autorisation de déploiement. Les prérequis, les droits d’accès et les contrôles humains doivent rester respectés.",
  UNCERTAINTY:
    "Une hypothèse ou une contradiction doit être vérifiée. Une explication plus convaincante ne remplace pas une preuve et ne change pas la décision du moteur.",
} as const;
export type AuditExplanationTopic = keyof typeof auditExplanationTopics;
export interface AuditExplanationSelector {
  select(topics: readonly AuditExplanationTopic[]): Promise<readonly AuditExplanationTopic[]>;
}

export function availableExplanationTopics(answer: AskAutomateXResponse): AuditExplanationTopic[] {
  const topics: AuditExplanationTopic[] = [];
  if (/ECONOMIC|ROI/.test(answer.intent.intentType)) topics.push("ECONOMICS");
  if (/EVIDENCE|KNOW|MISSING/.test(answer.intent.intentType)) topics.push("EVIDENCE");
  if (/DECISION|AUTOMATE|PRIORITY|NEXT|FIX/.test(answer.intent.intentType))
    topics.push("HUMAN_CONTROL");
  if (answer.unknowns.length || answer.contradictions.length) topics.push("UNCERTAINTY");
  return topics;
}

export async function attachAuditExplanation(
  answer: AskAutomateXResponse,
  selector?: AuditExplanationSelector,
): Promise<AskAutomateXResponse> {
  if (!selector || !["ANSWERED", "ANSWERED_WITH_UNCERTAINTY"].includes(answer.answerStatus))
    return answer;
  const allowed = availableExplanationTopics(answer);
  if (!allowed.length) return answer;
  try {
    const selected = await selector.select(allowed);
    if (
      !selected.length ||
      selected.length > 3 ||
      new Set(selected).size !== selected.length ||
      selected.some((id) => !allowed.includes(id))
    )
      return answer;
    return {
      ...answer,
      explanation: {
        kind: "BOUNDED_EDUCATIONAL_SUPPORT",
        paragraphs: selected.map((id) => auditExplanationTopics[id]),
      },
    };
  } catch {
    return answer;
  }
}
