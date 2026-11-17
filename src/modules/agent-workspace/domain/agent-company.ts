import { z } from "zod";

export const agentProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    role: z.string().trim().min(2).max(160),
  })
  .strict();
export const agentCompanyInputSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(2).max(120),
    objective: z.string().trim().min(10).max(2000),
    mode: z.enum(["guided", "template", "manual"]),
    autonomy: z.enum(["approval", "scoped", "bounded"]),
    agents: z
      .array(agentProfileSchema)
      .min(1)
      .max(3)
      .refine(
        (agents) =>
          new Set(agents.map((a) => a.name.toLocaleLowerCase("fr"))).size === agents.length,
        "Les noms des agents doivent être distincts.",
      ),
    companyId: z.string().uuid().nullable(),
  })
  .strict();
export type AgentCompanyInput = z.infer<typeof agentCompanyInputSchema>;
export const agentCompanySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  objective: z.string(),
  mode: z.enum(["guided", "template", "manual"]),
  autonomy: z.enum(["approval", "scoped", "bounded"]),
  agents: z.array(agentProfileSchema).min(1).max(3),
  company_id: z.string().uuid().nullable(),
  status: z.literal("preparation"),
  api_budget_euro: z.literal(0),
  concurrency_limit: z.literal(1),
  created_at: z.string(),
});
export type AgentCompany = z.infer<typeof agentCompanySchema>;
export const agentCompanyListSchema = z.object({
  items: z.array(agentCompanySchema).max(20),
  hasMore: z.boolean(),
});
export const teamTemplates = {
  general: [
    {
      name: "Coordinateur",
      role: "Clarifier l’objectif, organiser le travail et demander les validations",
    },
    {
      name: "Exécutant",
      role: "Réaliser la mission avec les outils autorisés et fournir les preuves",
    },
  ],
  research: [
    { name: "Responsable de recherche", role: "Définir les questions et vérifier les sources" },
    { name: "Analyste", role: "Rechercher, comparer et préparer un rapport sourcé" },
  ],
  content: [
    { name: "Responsable éditorial", role: "Définir le brief et les critères de qualité" },
    { name: "Rédacteur", role: "Préparer les contenus et livrables pour validation humaine" },
  ],
} satisfies Record<string, z.infer<typeof agentProfileSchema>[]>;
