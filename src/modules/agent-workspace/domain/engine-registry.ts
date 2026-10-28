import { z } from "zod";
import { freeMissionInput } from "./free-pilot";

const identifier = z.string().regex(/^[a-z0-9][a-z0-9.-]{1,63}$/);
export const engineManifestSchema = z
  .object({
    version: z.literal(1),
    id: identifier,
    name: z.string().trim().min(2).max(80),
    category: z.enum([
      "business",
      "agent",
      "orchestration",
      "automation",
      "analysis",
      "security",
      "models",
    ]),
    description: z.string().trim().min(10).max(300),
    wiring: z.enum(["canonical", "adapter", "indirect", "planned"]),
    protocols: z
      .array(z.enum(["internal", "http", "mcp", "cli", "openai-compatible"]))
      .min(1)
      .max(5),
    capabilities: z
      .array(
        z
          .object({
            id: identifier,
            label: z.string().min(2).max(100),
            mode: z.enum(["dispatch", "navigation", "dependency", "planned"]),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    prerequisite: z.string().min(10).max(400),
    source: z
      .string()
      .url()
      .refine((value) => new URL(value).protocol === "https:"),
  })
  .strict();
export type EngineManifest = z.infer<typeof engineManifestSchema>;

/** Declarative metadata never installs an engine or grants execution privileges. */
export function createEngineRegistry(input: unknown): readonly EngineManifest[] {
  const entries = z.array(engineManifestSchema).min(1).max(100).parse(input);
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length)
    throw new Error("Duplicate engine identifier");
  for (const entry of entries) {
    if (
      new Set(entry.capabilities.map((capability) => capability.id)).size !==
      entry.capabilities.length
    )
      throw new Error("Duplicate capability identifier");
  }
  return entries;
}

export const engineRegistry = createEngineRegistry([
  {
    version: 1,
    id: "optivos-audit",
    name: "Audit Optivos",
    category: "business",
    description: "Analyser l’entreprise, prioriser ses automatisations et consulter ses résultats.",
    wiring: "canonical",
    protocols: ["internal"],
    capabilities: [{ id: "audit.open", label: "Ouvrir le parcours audit", mode: "navigation" }],
    prerequisite: "Dossier d’entreprise et droits dans l’organisation existante.",
    source: "https://github.com/kraos026/Taratra",
  },
  {
    version: 1,
    id: "hermes",
    name: "Hermes",
    category: "agent",
    description: "Produire un texte et suivre la mission jusqu’à sa validation humaine.",
    wiring: "adapter",
    protocols: ["http"],
    capabilities: [
      { id: "text.generate", label: "Mission textuelle avec preuve de coût", mode: "dispatch" },
    ],
    prerequisite:
      "Espace lié au pilote VPS, modèle gratuit vérifié et lancement explicite ; santé à vérifier.",
    source: "https://github.com/NousResearch/hermes-agent",
  },
  {
    version: 1,
    id: "paperclip",
    name: "Paperclip",
    category: "orchestration",
    description: "Organiser des agents, leurs objectifs, leurs responsabilités et leurs budgets.",
    wiring: "planned",
    protocols: ["http"],
    capabilities: [{ id: "team.coordinate", label: "Coordination d’équipe", mode: "planned" }],
    prerequisite:
      "Adaptateur, correspondance des identités et autorisations de délégation à construire.",
    source: "https://github.com/paperclipai/paperclip",
  },
  {
    version: 1,
    id: "opencode",
    name: "OpenCode",
    category: "agent",
    description: "Confier des travaux de développement à un environnement de code isolé.",
    wiring: "planned",
    protocols: ["http", "cli"],
    capabilities: [{ id: "code.task", label: "Mission de développement", mode: "planned" }],
    prerequisite:
      "Serveur OpenCode isolé, dépôt autorisé et adaptateur de sessions/livrables requis.",
    source: "https://opencode.ai/docs/server/",
  },
  {
    version: 1,
    id: "n8n",
    name: "n8n",
    category: "automation",
    description: "Exécuter des workflows et relier des événements à des actions déterministes.",
    wiring: "planned",
    protocols: ["http"],
    capabilities: [{ id: "workflow.run", label: "Exécution de workflow", mode: "planned" }],
    prerequisite:
      "Instance, workflows autorisés et adaptateur requis ; conditions de licence à vérifier pour l’offre vendue.",
    source: "https://github.com/n8n-io/n8n",
  },
  {
    version: 1,
    id: "rea",
    name: "REA",
    category: "analysis",
    description: "Analyser du code et conserver des preuves structurelles de l’analyse.",
    wiring: "planned",
    protocols: ["cli"],
    capabilities: [{ id: "code.analyze", label: "Analyse statique de code", mode: "planned" }],
    prerequisite:
      "L’outil opérateur existe ; son adaptateur client et ses limites de ressources restent à raccorder.",
    source: "https://github.com/morluto/rea",
  },
  {
    version: 1,
    id: "hexstrike",
    name: "HexStrike",
    category: "security",
    description: "Utiliser des outils de sécurité sur les actifs explicitement autorisés.",
    wiring: "planned",
    protocols: ["mcp", "http"],
    capabilities: [
      { id: "security.assess", label: "Analyse de sécurité encadrée", mode: "planned" },
    ],
    prerequisite:
      "Adaptateur client, cible/périmètre approuvés, isolation et validation des outils requis.",
    source: "https://github.com/0x4m4/hexstrike-ai",
  },
  {
    version: 1,
    id: "openrouter",
    name: "OpenRouter",
    category: "models",
    description: "Accéder aux modèles utilisés par les agents via une passerelle de fournisseur.",
    wiring: "indirect",
    protocols: ["openai-compatible"],
    capabilities: [{ id: "model.provide", label: "Modèle du pilote Hermes", mode: "dependency" }],
    prerequisite:
      "Utilisé par le pilote avec son modèle gratuit imposé ; aucune sélection libre ni repli payant.",
    source: "https://openrouter.ai/docs/api/reference/overview",
  },
  {
    version: 1,
    id: "9router",
    name: "9Router",
    category: "models",
    description: "Router des requêtes de modèles via une passerelle compatible OpenAI.",
    wiring: "planned",
    protocols: ["openai-compatible"],
    capabilities: [{ id: "model.route", label: "Routage de modèles", mode: "planned" }],
    prerequisite:
      "Instance et adaptateur requis ; tarif et replis doivent respecter le budget, gratuité non présumée.",
    source: "https://github.com/decolua/9router",
  },
]);

export const dispatchInputSchema = z
  .object({
    version: z.literal(1),
    engineId: identifier,
    capability: identifier,
    mission: freeMissionInput,
  })
  .strict();

export function resolveEngineCapability(engineId: string, capabilityId: string) {
  const engine = engineRegistry.find((entry) => entry.id === engineId);
  const capability = engine?.capabilities.find((entry) => entry.id === capabilityId);
  return engine && capability ? { engine, capability } : null;
}
