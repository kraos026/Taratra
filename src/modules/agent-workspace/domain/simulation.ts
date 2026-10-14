export type SimulationState = "ready" | "approval" | "running" | "completed" | "stopped";
export interface AgentMission {
  id: string;
  companyId: string;
  title: string;
  brief: string;
  state: SimulationState;
  result: string | null;
  events: string[];
}
export function prepareAgentMission(
  id: string,
  companyId: string,
  title: string,
  brief: string,
): AgentMission {
  title = title.trim();
  brief = brief.trim();
  if (
    !companyId ||
    title.length < 3 ||
    title.length > 120 ||
    brief.length < 10 ||
    brief.length > 4000
  )
    throw new Error("Demande invalide.");
  return {
    id,
    companyId,
    title,
    brief,
    state: "approval",
    result: null,
    events: ["Demande préparée ; validation attendue."],
  };
}
export function moveAgentMission(
  mission: AgentMission,
  companyId: string,
  action: "approve" | "finish" | "stop",
): AgentMission {
  if (mission.companyId !== companyId) throw new Error("Contexte entreprise différent.");
  if (action === "approve" && mission.state === "approval")
    return {
      ...mission,
      state: "running",
      events: [...mission.events, "Simulation validée. Aucun agent réel appelé."],
    };
  if (action === "finish" && mission.state === "running")
    return {
      ...mission,
      state: "completed",
      result: `EXEMPLE SIMULÉ\n\nMission : ${mission.title}\nRésultat attendu : ${mission.brief}\n\nCette démonstration vérifie le parcours de mission. Aucun document métier n’a été produit par Hermes.`,
      events: [...mission.events, "Exemple de résultat disponible. Coût des appels IA : 0 €."],
    };
  if (action === "stop" && (mission.state === "approval" || mission.state === "running"))
    return { ...mission, state: "stopped", events: [...mission.events, "Simulation arrêtée."] };
  return mission;
}
