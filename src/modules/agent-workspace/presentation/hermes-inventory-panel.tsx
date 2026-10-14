"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { hermesInventorySchema, type HermesInventory } from "../domain/hermes-inventory";

const labels = {
  available: "Inventaire vérifié",
  unconfigured: "Connexion non configurée",
  unlinked: "Ce dossier n’est pas lié à Hermes",
  unavailable: "Inventaire indisponible",
};
export function HermesInventoryPanel({ companyId }: { companyId: string }) {
  const [inventory, setInventory] = useState<HermesInventory | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function check() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setChecking(true);
    setInventory(null);
    setError("");
    try {
      const response = await fetch(
        `/api/companies/${encodeURIComponent(companyId)}/atelier-ia/inventory`,
        { cache: "no-store", signal: controller.signal },
      );
      if (!response.ok) throw new Error("Unavailable");
      const body = (await response.json()) as { data?: unknown };
      const parsed = hermesInventorySchema.safeParse(body.data);
      if (!parsed.success) throw new Error("Invalid inventory");
      if (!controller.signal.aborted) setInventory(parsed.data);
    } catch {
      if (!controller.signal.aborted)
        setError("Vérification impossible. Réessayez pour obtenir un inventaire actualisé.");
    } finally {
      if (!controller.signal.aborted) setChecking(false);
      request.current = null;
    }
  }
  return (
    <section
      className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/70 p-5 sm:p-6"
      aria-label="Inventaire Hermes"
    >
      <h2 className="text-lg font-semibold">Ce qui est présent dans Hermes</h2>
      <p className="text-sm leading-6 text-slate-300">
        Consultez les skills et groupes d’outils du serveur lié à cette entreprise. Cette lecture
        n’installe rien et ne lance aucune mission.
      </p>
      <Button className="min-h-11" disabled={checking} onClick={check}>
        {checking ? "Vérification en cours…" : "Vérifier les capacités"}
      </Button>
      <p role="status" aria-live="polite" className="text-sm text-slate-300">
        {error ||
          (inventory
            ? `Vérifié à ${new Date(inventory.checkedAt).toLocaleTimeString("fr-FR")}. L’installation peut évoluer.`
            : "Aucun inventaire chargé automatiquement.")}
      </p>
      {inventory && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="font-semibold">Skills installés</h3>
            <p className="mt-2 text-sm text-slate-300">{labels[inventory.skills.state]}</p>
            {inventory.skills.state === "available" && (
              <>
                <p className="mt-2 text-sm">{inventory.skills.items.length} skills trouvés</p>
                <ul className="mt-3 max-h-96 space-y-3 overflow-y-auto rounded-xl border border-white/10 p-3">
                  {inventory.skills.items.map((skill) => (
                    <li key={skill.name} className="text-sm">
                      <strong className="break-words">{skill.name}</strong>
                      <p className="mt-1 break-words text-slate-400">{skill.description}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div>
            <h3 className="font-semibold">Groupes d’outils</h3>
            <p className="mt-2 text-sm text-slate-300">{labels[inventory.toolsets.state]}</p>
            {inventory.toolsets.state === "available" && (
              <>
                <p className="mt-2 text-sm">{inventory.toolsets.items.length} groupes trouvés</p>
                <ul className="mt-3 max-h-96 space-y-3 overflow-y-auto rounded-xl border border-white/10 p-3">
                  {inventory.toolsets.items.map((item) => (
                    <li key={item.name} className="text-sm">
                      <strong className="break-words">{item.label || item.name}</strong>
                      <p className="mt-1 text-slate-400">
                        Activation :{" "}
                        {item.enabled === null ? "non indiquée" : item.enabled ? "oui" : "non"} ·
                        Configuration :{" "}
                        {item.configured === null
                          ? "non indiquée"
                          : item.configured
                            ? "oui"
                            : "non"}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
      <p className="text-sm leading-6 text-slate-400">
        Un outil installé ou activé peut encore manquer d’accès. La réussite d’une tâche et son coût
        doivent être vérifiés séparément. Les connexions API, MCP et plugins détaillées ne sont pas
        importées par cette lecture.
      </p>
    </section>
  );
}
