import { z } from "zod";

export const hermesRunIdSchema = z.string().regex(/^run_[0-9a-f]{32}$/);
export const missionLinkSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(120),
  created_at: z.string().datetime({ offset: true }),
});
export const missionLinksSchema = z.object({
  items: z.array(missionLinkSchema).max(20),
  hasMore: z.boolean(),
});
export type MissionLink = z.infer<typeof missionLinkSchema>;
export const hermesRunStates = [
  "queued",
  "pending",
  "starting",
  "running",
  "awaiting_approval",
  "waiting_for_approval",
  "stopping",
  "completed",
  "failed",
  "cancelled",
  "interrupted",
] as const;
export const missionObservationSchema = z
  .object({
    availability: z.enum(["available", "unconfigured", "unlinked", "unavailable", "not_found"]),
    status: z.enum(hermesRunStates).nullable(),
    checkedAt: z.string().datetime(),
  })
  .refine((value) => (value.availability === "available") === (value.status !== null));
export type MissionObservation = z.infer<typeof missionObservationSchema>;
export const missionStateLabels: Record<(typeof hermesRunStates)[number], string> = {
  queued: "En attente",
  pending: "En attente",
  starting: "Démarrage",
  running: "En cours",
  awaiting_approval: "Validation attendue",
  waiting_for_approval: "Validation attendue",
  stopping: "Arrêt en cours",
  completed: "Terminée",
  failed: "Échec",
  cancelled: "Arrêtée",
  interrupted: "Interrompue",
};
