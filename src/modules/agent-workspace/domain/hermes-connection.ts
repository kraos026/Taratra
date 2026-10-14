export type HermesConnection = {
  state: "unconfigured" | "unlinked" | "unavailable" | "connected";
  checkedAt: string;
  monitoring: { status: boolean; events: boolean };
  liveExecution: false;
  modelCalls: 0;
};

export const hermesConnectionLabels = {
  unconfigured: "Connexion non configurée",
  unlinked: "Ce dossier n’est pas lié à Hermes",
  unavailable: "Hermes est temporairement indisponible",
  connected: "Connexion Hermes vérifiée",
} as const;

export function isHermesConnection(value: unknown): value is HermesConnection {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<HermesConnection>;
  return (
    typeof data.state === "string" &&
    Object.hasOwn(hermesConnectionLabels, data.state) &&
    typeof data.checkedAt === "string" &&
    Number.isFinite(Date.parse(data.checkedAt)) &&
    typeof data.monitoring?.status === "boolean" &&
    typeof data.monitoring?.events === "boolean" &&
    data.liveExecution === false &&
    data.modelCalls === 0
  );
}
