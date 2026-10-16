"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useImperativeHandle, type Ref } from "react";
import { Button } from "@/components/ui/button";
import { AgentAvatar } from "./agent-avatar";
import { CodexMenu } from "./codex-menu";
import { CodexDialog } from "./codex-settings";
import { ArrowUpRight, MessageSquare } from "lucide-react";
import {
  freeMissionListSchema,
  freeMissionSchema,
  freeReviewInput,
  freePilotReadinessSchema,
  type FreeMission,
} from "../domain/free-pilot";

const labels: Record<FreeMission["status"], string> = {
  queued: "En attente",
  running: "En cours",
  completed: "Résultat produit · à relire",
  failed: "Échec",
  stopping: "Arrêt demandé",
  stopped: "Arrêtée",
  interrupted: "Interrompue, sans rejeu automatique",
};
function missionLabel(item: FreeMission) {
  return item.status === "completed" && item.reviews.length
    ? item.reviews.at(-1)?.decision === "accepted"
      ? "Résultat accepté"
      : "Correction demandée"
    : labels[item.status];
}
export type FreePilotHandle = {
  newMission: () => void;
  search: () => void;
  refresh: () => void;
  exportResult: () => void;
  copyResult: () => void;
};
export function FreePilotPanel({
  workspaceId,
  canWrite,
  historyTarget,
  onMissionSelected,
  ref,
}: {
  workspaceId: string;
  canWrite: boolean;
  historyTarget?: HTMLElement | null;
  onMissionSelected?: () => void;
  ref?: Ref<FreePilotHandle>;
}) {
  const [ready, setReady] = useState(false);
  const [verifiedModel, setVerifiedModel] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [items, setItems] = useState<FreeMission[] | null>(null);
  const [selectedMission, setSelectedMission] = useState<string | null>(null);
  const [historyQuery, setHistoryQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchField = useRef<HTMLInputElement>(null);
  const historySearch = useRef<HTMLInputElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const intent = useRef<{ id: string; prompt: string } | null>(null);
  const [uncertain, setUncertain] = useState(false);
  useEffect(() => {
    if (searchOpen) searchField.current?.focus();
  }, [searchOpen]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [reviewIntent, setReviewIntent] = useState<{
    missionId: string;
    body: {
      id: string;
      decision: "accepted" | "changes_requested";
      comment: string;
      previousId: string | null;
    };
  } | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const base = `/api/atelier-ia/entreprises/${encodeURIComponent(workspaceId)}`;
  async function call(path: string, signal: AbortSignal, body?: unknown) {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      cache: "no-store",
      signal,
      ...(body === undefined
        ? {}
        : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
    const payload = (await response.json()) as { data?: unknown; error?: { message?: string } };
    if (!response.ok)
      throw Object.assign(new Error(payload.error?.message || "Le pilote est indisponible."), {
        status: response.status,
      });
    return payload.data;
  }
  async function run(operation: (signal: AbortSignal) => Promise<void>) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await operation(AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]));
    } catch (caught) {
      if (!controller.signal.aborted)
        setError(caught instanceof Error ? caught.message : "Vérification impossible.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      request.current = null;
    }
  }
  async function load(signal: AbortSignal) {
    const result = freeMissionListSchema.parse(await call("/missions", signal));
    setItems(result.items);
    setSelectedMission((current) =>
      result.items.some((item) => item.id === current) ? current : result.items[0]?.id || null,
    );
    setHasMore(result.hasMore);
    if (
      reviewIntent &&
      result.items.some(
        (item) =>
          item.id === reviewIntent.missionId &&
          item.reviews.some((review) => review.id === reviewIntent.body.id),
      )
    )
      setReviewIntent(null);
    if (intent.current && result.items.some((item) => item.id === intent.current?.id)) {
      intent.current = null;
      setUncertain(false);
      setPrompt("");
    }
  }
  async function submit(signal: AbortSignal) {
    const proposed = intent.current || { id: crypto.randomUUID(), prompt: prompt.trim() };
    intent.current = proposed;
    setUncertain(true);
    try {
      const item = freeMissionSchema.parse(await call("/missions", signal, proposed));
      setItems((current) =>
        [item, ...(current || []).filter((row) => row.id !== item.id)].slice(0, 20),
      );
      setSelectedMission(item.id);
      intent.current = null;
      setUncertain(false);
      setPrompt("");
      setMessage(
        "Mission enregistrée sur le VPS. Actualisez les missions pour consulter son état réel.",
      );
    } catch (caught) {
      if (
        caught &&
        typeof caught === "object" &&
        "status" in caught &&
        [400, 403, 409, 413, 415, 429].includes(Number(caught.status))
      ) {
        intent.current = null;
        setUncertain(false);
      }
      throw caught;
    }
  }
  async function review(
    signal: AbortSignal,
    item: FreeMission,
    decision: "accepted" | "changes_requested",
  ) {
    const proposed = reviewIntent || {
      missionId: item.id,
      body: {
        id: crypto.randomUUID(),
        decision,
        comment: (comments[item.id] || "").trim(),
        previousId: item.reviews.at(-1)?.id || null,
      },
    };
    if (!freeReviewInput.safeParse(proposed.body).success)
      throw new Error("Décrivez la correction en 10 à 500 caractères.");
    setReviewIntent(proposed);
    try {
      const updated = freeMissionSchema.parse(
        await call(`/missions/${proposed.missionId}/review`, signal, proposed.body),
      );
      setItems(
        (current) => current?.map((row) => (row.id === updated.id ? updated : row)) || [updated],
      );
      setReviewIntent(null);
      setMessage("Relecture enregistrée. Aucune nouvelle mission n’a été lancée.");
    } catch (caught) {
      if (
        caught &&
        typeof caught === "object" &&
        "status" in caught &&
        [400, 403, 404, 409, 413, 415, 429].includes(Number(caught.status))
      )
        setReviewIntent(null);
      throw caught;
    }
  }
  function newMission() {
    if (busy || uncertain || reviewIntent || !canWrite) {
      setError(
        "La nouvelle mission attend la fin de l’opération ou la résolution de la demande incertaine.",
      );
      return;
    }
    setSelectedMission(null);
    setPrompt("");
    setError("");
    setMessage("");
    onMissionSelected?.();
    composer.current?.focus();
  }
  function selectedResult(id = selectedMission) {
    const selected = items?.find((item) => item.id === id);
    if (!selected?.output || selected.status !== "completed" || !selected.proof) {
      setError("Sélectionnez un résultat terminé et vérifié avant cette action.");
      return null;
    }
    return selected;
  }
  function exportResult(id = selectedMission) {
    const selected = selectedResult(id);
    if (!selected) return;
    const url = URL.createObjectURL(
      new Blob([selected.output!], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `optivos-mission-${selected.id}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function copyResult(id = selectedMission) {
    const selected = selectedResult(id);
    if (!selected) return;
    if (!navigator.clipboard) {
      setError("Le navigateur ne permet pas la copie dans ce contexte.");
      return;
    }
    void navigator.clipboard.writeText(selected.output!).then(
      () => setMessage("Résultat copié."),
      () => setError("Copie refusée par le navigateur."),
    );
  }
  useImperativeHandle(ref, () => ({
    newMission,
    search: () => {
      setSearchQuery("");
      setSearchOpen(true);
    },
    refresh: () => {
      void run(load);
    },
    exportResult: () => exportResult(),
    copyResult: () => copyResult(),
  }));
  const history = (
    <details open className="pilot-history" aria-label="Historique des missions">
      <summary className="min-h-11 cursor-pointer py-3 text-xs font-semibold tracking-wider text-slate-400 uppercase">
        <MessageSquare className="mr-2 inline" size={14} aria-hidden="true" />
        Récents ({items?.length || 0})
      </summary>
      <label className="sr-only" htmlFor={`mission-search-${workspaceId}`}>
        Rechercher dans les missions chargées
      </label>
      <input
        ref={historySearch}
        id={`mission-search-${workspaceId}`}
        type="search"
        value={historyQuery}
        onChange={(event) => setHistoryQuery(event.target.value)}
        placeholder="Rechercher"
        className="codex-history-search"
      />
      <Button
        type="button"
        variant="ghost"
        className="min-h-11 w-full justify-start"
        disabled={busy || uncertain || !!reviewIntent || !canWrite}
        onClick={newMission}
      >
        Nouvelle mission
      </Button>
      {items
        ?.filter((item) =>
          item.prompt.toLocaleLowerCase("fr").includes(historyQuery.toLocaleLowerCase("fr")),
        )
        .map((item) => (
          <div
            key={item.id}
            className="codex-project-row"
            onContextMenu={(event) => {
              event.preventDefault();
              event.currentTarget.querySelector<HTMLButtonElement>("[aria-haspopup=menu]")?.click();
            }}
          >
            <button
              type="button"
              key={item.id}
              disabled={busy}
              aria-pressed={selectedMission === item.id}
              onClick={() => {
                setSelectedMission(item.id);
                onMissionSelected?.();
                transcript.current?.focus();
              }}
              className={`mb-2 block min-h-11 w-full rounded-xl p-3 text-left text-sm ${selectedMission === item.id ? "bg-indigo-400/10 text-indigo-100" : "text-slate-300 hover:bg-white/5"}`}
            >
              <span className="line-clamp-2 break-words">{item.prompt}</span>
              <span className="mt-1 block text-xs text-slate-400">État : {missionLabel(item)}</span>
            </button>
            <CodexMenu
              label={`Options de la mission ${item.prompt.slice(0, 60)}`}
              items={[
                {
                  label: "Ouvrir",
                  action: () => {
                    setSelectedMission(item.id);
                    onMissionSelected?.();
                  },
                },
                { label: "Copier le résultat", action: () => copyResult(item.id) },
                { label: "Exporter le résultat…", action: () => exportResult(item.id) },
                ...[
                  "Épingler",
                  "Renommer",
                  "Marquer comme non lu",
                  "Déplacer vers un projet",
                  "Partager",
                  "Dupliquer / bifurquer",
                  "Archiver",
                  "Supprimer",
                ].map((label) => ({
                  label,
                  unavailable:
                    "Cette opération n’est pas raccordée au service de missions. Aucun changement effectué.",
                })),
              ]}
            >
              <span aria-hidden="true">···</span>
            </CodexMenu>
          </div>
        ))}
      {!items?.length && (
        <p className="text-sm leading-6 text-slate-400">
          Actualisez pour retrouver vos missions enregistrées.
        </p>
      )}
      <Button
        className="min-h-11"
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => run(load)}
      >
        Actualiser les missions
      </Button>
    </details>
  );
  return (
    <section aria-label="Missions textuelles pilotes" className="pilot-workspace">
      {historyTarget ? createPortal(history, historyTarget) : history}
      <div className="pilot-sessionbar">
        <span>
          Hermes <span className="text-slate-500">/ mission textuelle</span>
        </span>
        <details className="pilot-options">
          <summary>Options du pilote</summary>
          <div>
            Le pilote produit du texte, avec un contrôle du modèle gratuit avant chaque lancement.
            Outils externes, skills, plugins et actions sur les comptes désactivés. Aucun repli
            payant.
          </div>
        </details>
      </div>
      <div className="pilot-thread">
        <div
          ref={transcript}
          className="pilot-transcript"
          tabIndex={0}
          aria-label="Fil de la mission"
        >
          {!selectedMission && (
            <div className="pilot-empty">
              <AgentAvatar variant={1} size={80} />
              <h5 className="mt-4 text-xl font-semibold">Quel travail voulez-vous avancer ?</h5>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
                Décrivez un résultat concret. Hermes prépare un texte que vous pourrez relire et
                valider.
              </p>
            </div>
          )}
          <div role="status" aria-live="polite" className="py-3 text-sm text-slate-300">
            {error ||
              message ||
              (ready
                ? "Pilote vérifié. Les états s’actualisent à votre demande."
                : "Aucune lecture automatique. Commencez par vérifier le pilote.")}
          </div>
          {items?.length === 0 && (
            <p className="text-sm text-slate-400">Aucune mission enregistrée pour cet espace.</p>
          )}
          <div className="space-y-3">
            {items
              ?.filter((item) => item.id === selectedMission)
              .map((item) => (
                <article key={item.id} className="space-y-4 py-4">
                  <div className="pilot-user-message">
                    <p className="mb-2 text-xs font-semibold text-indigo-200">Votre demande</p>
                    <p className="text-sm break-words whitespace-pre-wrap text-slate-200">
                      {item.prompt}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <AgentAvatar variant={1} size={32} />
                    <span className="text-sm font-semibold">Hermes</span>
                  </div>
                  <p className="text-sm font-semibold">{missionLabel(item)}</p>
                  {item.output && (
                    <div className="pilot-answer text-sm leading-7 break-words whitespace-pre-wrap">
                      {item.output}
                    </div>
                  )}
                  {item.proof && (
                    <p className="text-xs leading-5 text-emerald-200">
                      Réponse réelle Hermes · coût API vérifié : 0 $ · {item.proof.model} · aucun
                      outil, aucun repli
                    </p>
                  )}
                  {item.error && <p className="text-sm text-amber-200">{item.error}</p>}
                  {item.reviews.length > 0 && (
                    <details className="text-sm">
                      <summary className="min-h-11 cursor-pointer py-3">
                        Historique des relectures ({item.reviews.length})
                      </summary>
                      <ol className="space-y-2">
                        {item.reviews.map((entry) => (
                          <li key={entry.id} className="break-words whitespace-pre-wrap">
                            {entry.decision === "accepted" ? "Accepté" : "Correction demandée"} ·{" "}
                            {new Date(entry.created_at * 1000).toLocaleString("fr-FR")}
                            {entry.comment ? ` : ${entry.comment}` : ""}
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                  {canWrite && item.status === "completed" && item.proof && item.output && (
                    <details className="space-y-3 rounded-xl border border-white/10 p-3">
                      <summary className="min-h-11 cursor-pointer py-3 text-sm text-indigo-200">
                        Relire ou corriger ce résultat
                      </summary>
                      <label htmlFor={`review-${item.id}`} className="block text-sm">
                        Votre retour sur ce résultat
                      </label>
                      <textarea
                        id={`review-${item.id}`}
                        maxLength={500}
                        rows={3}
                        value={comments[item.id] || ""}
                        disabled={busy || !!reviewIntent}
                        onChange={(event) =>
                          setComments((current) => ({ ...current, [item.id]: event.target.value }))
                        }
                        className="w-full rounded-xl border border-white/15 bg-slate-950 p-3 text-sm"
                        placeholder="Indiquez précisément les changements souhaités."
                      />
                      <div className="flex flex-wrap gap-3">
                        <Button
                          type="button"
                          className="min-h-11"
                          disabled={busy || !!reviewIntent || item.reviews.length >= 20}
                          onClick={() => run((signal) => review(signal, item, "accepted"))}
                        >
                          Accepter le résultat
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          disabled={
                            busy ||
                            !!reviewIntent ||
                            item.reviews.length >= 20 ||
                            (comments[item.id] || "").trim().length < 10
                          }
                          onClick={() => run((signal) => review(signal, item, "changes_requested"))}
                        >
                          Demander une correction
                        </Button>
                        {reviewIntent?.missionId === item.id && (
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11"
                            disabled={busy}
                            onClick={() =>
                              run((signal) => review(signal, item, reviewIntent.body.decision))
                            }
                          >
                            Reprendre la même relecture
                          </Button>
                        )}
                      </div>
                      {item.reviews.at(-1)?.decision === "changes_requested" && (
                        <p className="text-sm text-slate-300">
                          La demande est enregistrée. Pour obtenir une nouvelle version, confiez
                          explicitement une nouvelle mission en reprenant votre retour et les
                          éléments utiles du texte.
                        </p>
                      )}
                      {reviewIntent?.missionId === item.id && (
                        <p className="text-sm text-amber-200">
                          Enregistrement incertain : reprenez la même relecture ou actualisez les
                          missions.
                        </p>
                      )}
                    </details>
                  )}
                  {canWrite && ["queued", "running"].includes(item.status) && (
                    <Button
                      className="min-h-11"
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run(async (signal) => {
                          await call(`/missions/${encodeURIComponent(item.id)}/stop`, signal, {});
                          await load(signal);
                          setMessage(
                            "Arrêt demandé au prochain point sûr. Une requête fournisseur déjà acceptée peut finir.",
                          );
                        })
                      }
                    >
                      Demander l’arrêt
                    </Button>
                  )}
                </article>
              ))}
          </div>
        </div>
        {canWrite && (
          <form
            className="pilot-composer space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void run(submit);
            }}
          >
            <label htmlFor={`pilot-prompt-${workspaceId}`} className="sr-only">
              Quelle mission textuelle confier à Hermes ?
            </label>
            <textarea
              ref={composer}
              id={`pilot-prompt-${workspaceId}`}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              required
              minLength={10}
              maxLength={2000}
              disabled={busy || uncertain}
              rows={2}
              className="w-full rounded-xl border border-white/15 bg-slate-950 p-3 text-sm"
              placeholder="Exemple : prépare une procédure d’accueil client en cinq étapes."
            />
            <div className="codex-composer-menu-row">
              <CodexMenu
                label="Ajouter des fichiers et plus"
                items={[
                  {
                    label: "Ajouter des fichiers",
                    unavailable: "L’envoi de pièces jointes à Hermes n’est pas raccordé.",
                  },
                  {
                    label: "Ajouter des images",
                    unavailable: "Le pilote actuel accepte uniquement une demande textuelle.",
                  },
                  {
                    label: "Compétences",
                    unavailable:
                      "Choisissez Compétences dans la barre latérale pour consulter l’inventaire réel.",
                  },
                  {
                    label: "Applications et MCP",
                    unavailable:
                      "L’utilisation de connecteurs externes n’est pas activée dans le pilote.",
                  },
                ]}
              >
                <span aria-hidden="true">＋</span>
              </CodexMenu>
              <CodexMenu
                label="Lieu d’exécution"
                items={[
                  {
                    label: "VPS Hostinger — cible du pilote",
                    unavailable:
                      "La connexion est vérifiée par le service lors du lancement ; ce menu ne la modifie pas.",
                  },
                  { label: "Local", unavailable: "Le runtime local n’est pas raccordé." },
                  {
                    label: "Worktree",
                    unavailable: "Les worktrees ne sont pas raccordés à Hermes.",
                  },
                  {
                    label: "Cloud",
                    unavailable: "Aucun environnement cloud supplémentaire n’est raccordé.",
                  },
                ]}
              >
                VPS⌄
              </CodexMenu>
              <CodexMenu
                label="Choisir un modèle"
                items={[
                  {
                    label: verifiedModel || "Modèle gratuit — à vérifier",
                    unavailable:
                      "Le modèle est imposé par la barrière de gratuité du service. Utilisez Vérifier le pilote gratuit.",
                  },
                  {
                    label: "OpenRouter",
                    unavailable:
                      "Le service utilise uniquement son modèle gratuit vérifié ; aucun changement de modèle depuis ce menu.",
                  },
                  { label: "9Router", unavailable: "9Router n’est pas raccordé." },
                  {
                    label: "Modèle local / Ollama",
                    unavailable: "L’inférence locale n’est pas raccordée à ce pilote.",
                  },
                ]}
              >
                Modèle⌄
              </CodexMenu>
              <CodexMenu
                label="Autorisations de la mission"
                items={[
                  {
                    label: "Texte uniquement — actif",
                    unavailable: "Cette limite est imposée côté serveur.",
                  },
                  {
                    label: "Lecture seule",
                    unavailable: "Les outils de lecture externes ne sont pas activés.",
                  },
                  {
                    label: "Accès complet",
                    unavailable: "L’accès complet n’est pas autorisé dans ce pilote.",
                  },
                ]}
              >
                Autorisations⌄
              </CodexMenu>
              <CodexMenu
                label="Effort de raisonnement"
                items={["Désactivé — actif", "Faible", "Moyen", "Élevé"].map((label) => ({
                  label,
                  unavailable:
                    "Le raisonnement supplémentaire est désactivé par le profil du pilote ; cette commande ne modifie pas le modèle.",
                }))}
              >
                Effort⌄
              </CodexMenu>
            </div>
            <div className="pilot-composer-footer">
              <Button
                className="min-h-11"
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run(async (signal) => {
                    setReady(false);
                    setVerifiedModel(null);
                    const readiness = freePilotReadinessSchema.parse(
                      await call("/readiness", signal),
                    );
                    setVerifiedModel(readiness.policy.model);
                    setReady(true);
                    setMessage("Pilote gratuit vérifié. Aucun outil externe ni repli autorisé.");
                  })
                }
              >
                Vérifier le pilote gratuit
              </Button>
              <Button
                className="min-h-11"
                aria-label={uncertain ? "Reprendre la même demande" : "Lancer la mission textuelle"}
                type="submit"
                disabled={busy || !ready || (!uncertain && prompt.trim().length < 10)}
              >
                <ArrowUpRight size={16} aria-hidden="true" />
                {uncertain ? "Reprendre la même demande" : "Envoyer"}
              </Button>
            </div>
            {uncertain && (
              <p className="text-sm text-amber-200">
                La même demande et son identifiant sont conservés pour éviter un double lancement.
                Actualisez les missions ou reprenez cette demande.
              </p>
            )}
          </form>
        )}
      </div>
      {hasMore && (
        <p className="text-sm text-slate-400">
          Les vingt missions les plus récentes sont affichées.
        </p>
      )}
      {searchOpen && (
        <CodexDialog
          title="Rechercher"
          onClose={() => setSearchOpen(false)}
          className="codex-search-dialog"
        >
          <div className="codex-feature-body">
            <label className="sr-only" htmlFor={`global-search-${workspaceId}`}>
              Rechercher dans les conversations chargées
            </label>
            <input
              ref={searchField}
              id={`global-search-${workspaceId}`}
              className="codex-history-search"
              type="search"
              maxLength={200}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Rechercher une conversation"
            />
            <p className="codex-setting-note">
              Recherche locale dans les vingt missions chargées au maximum. Aucun appel à un modèle.
            </p>
            <div className="codex-search-results">
              {items
                ?.filter((item) =>
                  (item.prompt + " " + (item.output || ""))
                    .toLocaleLowerCase("fr")
                    .includes(searchQuery.toLocaleLowerCase("fr")),
                )
                .map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      setSelectedMission(item.id);
                      setSearchOpen(false);
                      onMissionSelected?.();
                    }}
                  >
                    <span>{item.prompt}</span>
                    <small>{missionLabel(item)}</small>
                  </button>
                ))}
            </div>
            {!!searchQuery &&
              !items?.some((item) =>
                (item.prompt + " " + (item.output || ""))
                  .toLocaleLowerCase("fr")
                  .includes(searchQuery.toLocaleLowerCase("fr")),
              ) && <p>Aucune conversation chargée ne correspond.</p>}
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={busy}
              onClick={() => run(load)}
            >
              Actualiser les missions chargées
            </Button>
          </div>
        </CodexDialog>
      )}
    </section>
  );
}
