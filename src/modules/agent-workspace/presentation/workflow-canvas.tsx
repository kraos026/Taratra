"use client";
import { useRef, useState, type ChangeEvent } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Connection,
  type Node,
  type NodeProps,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AgentAvatar } from "./agent-avatar";
import {
  createWorkflowDraft,
  editWorkflow,
  nodeLabel,
  parseWorkflowDraft,
  removeDraftNode,
  replaceDraftNode,
  serializeWorkflowDraft,
  type RecipeId,
  type WorkflowDraft,
} from "../domain/workflow-draft";
import { referencePluginContracts } from "../domain/reference-workflows";
import {
  nodePorts,
  validateWorkflowDefinition,
  type ContractIssue,
} from "../domain/workflow-validation";
import type { WorkflowDocument, WorkflowNode } from "../domain/orchestration-contracts";

type FlowNode = Node<
  {
    label: string;
    kind: string;
    inputs: { id: string; type: string }[];
    outputs: { id: string; type: string }[];
    advanced: boolean;
  },
  "optivos"
>;
function WorkflowBlock({ data }: NodeProps<FlowNode>) {
  return (
    <div className="workflow-block">
      {data.kind === "capability" && <AgentAvatar size={32} />}
      <strong>{data.label}</strong>
      <small>{data.kind === "capability" ? "Capacité à raccorder" : "Bloc du workflow"}</small>
      {data.inputs.map((port, index) => (
        <Handle
          key={port.id}
          id={port.id}
          type="target"
          position={Position.Left}
          style={{ top: `${((index + 1) * 100) / (data.inputs.length + 1)}%` }}
          aria-label={`Entrée ${port.id} (${port.type})`}
        />
      ))}
      {data.outputs.map((port, index) => (
        <Handle
          key={port.id}
          id={port.id}
          type="source"
          position={Position.Right}
          style={{ top: `${((index + 1) * 100) / (data.outputs.length + 1)}%` }}
          aria-label={`Sortie ${port.id} (${port.type})`}
        />
      ))}
      {data.advanced && (
        <span className="workflow-port-summary">
          {data.inputs.map((p) => `${p.id} : ${p.type}`).join(" · ")} →{" "}
          {data.outputs.map((p) => `${p.id} : ${p.type}`).join(" · ")}
        </span>
      )}
    </div>
  );
}
const nodeTypes = { optivos: WorkflowBlock };
const recipes: [RecipeId, string][] = [
  ["generalHermes", "Mission Hermes"],
  ["auditToHermes", "Audit → Hermes"],
  ["n8nWorkflow", "Workflow n8n"],
  ["paperclipTeam", "Équipe Paperclip"],
];
const messages: Record<string, string> = {
  INVALID_CONTRACT: "Complétez les champs requis : 2 à 64 blocs et au moins une connexion.",
  MISSING_INPUT_BINDING: "Une entrée obligatoire n’est pas reliée.",
  UNUSED_NODE: "Ce bloc ne contribue à aucun livrable.",
  CYCLE_DETECTED: "Une boucle est présente : reliez les étapes dans un seul sens.",
  GRAPH_TOO_DEEP: "Le workflow dépasse 32 étapes successives.",
  MULTIPLE_INPUT_BINDINGS: "Cette entrée possède déjà une connexion.",
  UNKNOWN_CAPABILITY_VERSION: "La capacité ou sa version n’est pas reconnue.",
  PORT_TYPE_MISMATCH: "Les types des deux ports sont incompatibles.",
  UNKNOWN_PORT: "Un port de connexion n’existe plus.",
  INVALID_APPROVAL_SOURCE: "Une approbation doit venir d’un bloc de revue humaine.",
};
function makeDraft(recipe: RecipeId) {
  return createWorkflowDraft(recipe, crypto.randomUUID(), crypto.randomUUID());
}

export default function WorkflowCanvas({
  canWrite,
  onDirty,
}: {
  canWrite: boolean;
  onDirty: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<WorkflowDraft>(() => makeDraft("generalHermes"));
  const [selected, setSelected] = useState(draft.workflow.nodes[0].id);
  const [issues, setIssues] = useState<ContractIssue[] | null>(null);
  const [notice, setNotice] = useState("");
  const [entry, setEntry] = useState<"chat" | "template" | "canvas">("template");
  const [prompt, setPrompt] = useState("");
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [palette, setPalette] = useState("text");
  const importing = useRef(false);
  const flow = draft.workflow;
  const advanced = flow.presentation.view === "advanced";
  const chosen = flow.nodes.find((node) => node.id === selected);
  function update(change: WorkflowDraft | (() => WorkflowDraft), semantic = true) {
    if (!canWrite) return;
    let next: WorkflowDraft;
    try {
      next = typeof change === "function" ? change() : change;
    } catch (error) {
      setNotice((error as Error).message);
      return;
    }
    setDraft(next);
    setNotice("");
    onDirty(true);
    if (semantic) setIssues(null);
  }
  function changeGraph(next: WorkflowDocument) {
    try {
      update(editWorkflow(draft, next));
    } catch (error) {
      setNotice((error as Error).message);
    }
  }
  function chooseRecipe(recipe: RecipeId, mode: typeof entry) {
    if (
      !canWrite ||
      !window.confirm(
        "Remplacer le brouillon affiché ? Exportez-le d’abord si vous souhaitez le conserver.",
      )
    )
      return;
    const next = createWorkflowDraft(
      recipe,
      crypto.randomUUID(),
      crypto.randomUUID(),
      mode,
      prompt,
    );
    update(next);
    setSelected(next.workflow.nodes[0].id);
    setSource("");
    setTarget("");
  }
  function validate() {
    const result = validateWorkflowDefinition(flow, referencePluginContracts);
    setIssues(result.ok ? [] : result.issues);
    setNotice(
      result.ok
        ? "Structure valide. L’exécution de graphes n’est pas encore raccordée."
        : "Le brouillon doit être corrigé avant export.",
    );
  }
  function exportDraft() {
    try {
      const blob = new Blob([serializeWorkflowDraft(draft)], { type: "application/json" });
      const url = URL.createObjectURL(blob),
        anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `optivos-workflow-${flow.id}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      onDirty(false);
      setNotice("Fichier exporté. Le brouillon reste en mémoire dans cet écran.");
    } catch (error) {
      setNotice((error as Error).message);
    }
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !canWrite || importing.current) return;
    importing.current = true;
    try {
      if (file.size > 131072) throw new Error("Le fichier dépasse 128 Kio.");
      const next = parseWorkflowDraft(await file.text());
      if (!window.confirm("Remplacer le brouillon par ce fichier ? Aucun moteur ne sera lancé."))
        return;
      // Import never carries a usable authorization or workspace binding.
      next.mission.policy.autonomy = null;
      update(next);
      setSelected(next.workflow.nodes[0].id);
      setSource("");
      setTarget("");
      setNotice(
        "Brouillon importé. Les références devront être autorisées côté serveur avant toute exécution future.",
      );
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      importing.current = false;
    }
  }
  function connect(connection: Connection) {
    if (
      !canWrite ||
      !connection.sourceHandle ||
      !connection.targetHandle ||
      flow.edges.length >= 128
    )
      return;
    const from = flow.nodes.find((n) => n.id === connection.source),
      to = flow.nodes.find((n) => n.id === connection.target);
    const output =
      from &&
      nodePorts(from, referencePluginContracts)?.outputs.find(
        (p) => p.id === connection.sourceHandle,
      );
    const input =
      to &&
      nodePorts(to, referencePluginContracts)?.inputs.find((p) => p.id === connection.targetHandle);
    if (
      !output ||
      !input ||
      output.type !== input.type ||
      (input.type === "approval" && from?.kind !== "human-review")
    ) {
      setNotice("Ces ports ne sont pas compatibles.");
      return;
    }
    if (
      flow.edges.some(
        (e) => e.to.nodeId === connection.target && e.to.portId === connection.targetHandle,
      )
    ) {
      setNotice("Cette entrée est déjà reliée. Retirez sa connexion avant de la remplacer.");
      return;
    }
    const next = {
      ...flow,
      edges: [
        ...flow.edges,
        {
          id: `link-${crypto.randomUUID()}`,
          from: { nodeId: connection.source, portId: connection.sourceHandle },
          to: { nodeId: connection.target, portId: connection.targetHandle },
        },
      ],
    };
    const result = validateWorkflowDefinition(next, referencePluginContracts);
    if (
      !result.ok &&
      result.issues.some((i) => ["CYCLE_DETECTED", "GRAPH_TOO_DEEP"].includes(i.code))
    ) {
      setNotice("Cette connexion créerait une boucle ou un chemin trop profond.");
      return;
    }
    changeGraph(next);
  }
  function addNode() {
    if (!canWrite || flow.nodes.length >= 64) return;
    const id = `block-${crypto.randomUUID()}`;
    let node: WorkflowNode;
    const plugin = referencePluginContracts.find((p) => p.id === palette);
    if (plugin)
      node = {
        id,
        kind: "capability",
        pluginId: plugin.id,
        pluginVersion: plugin.version,
        capabilityId: plugin.capabilities[0].id,
      };
    else if (palette === "review") node = { id, kind: "human-review", label: "Relecture humaine" };
    else if (palette === "deliverable") node = { id, kind: "deliverable", label: "Livrable" };
    else if (palette === "transform") node = { id, kind: "transform", operation: "draft-text" };
    else node = { id, kind: "input", value: { type: "text", text: "Nouvelle consigne" } };
    changeGraph({
      ...flow,
      nodes: [...flow.nodes, node],
      presentation: {
        ...flow.presentation,
        positions: [
          ...flow.presentation.positions,
          { nodeId: id, x: 0, y: flow.nodes.length * 100 },
        ],
      },
    });
    setSelected(id);
  }
  const nodes: FlowNode[] = flow.nodes.map((node, index) => ({
    id: node.id,
    type: "optivos",
    position: flow.presentation.positions.find((p) => p.nodeId === node.id) || {
      x: index * 250,
      y: 0,
    },
    selected: node.id === selected,
    data: {
      label: nodeLabel(node),
      kind: node.kind,
      advanced,
      ...(nodePorts(node, referencePluginContracts) || { inputs: [], outputs: [] }),
    },
  }));
  const endpoints = (direction: "inputs" | "outputs") =>
    flow.nodes.flatMap((node) =>
      (nodePorts(node, referencePluginContracts)?.[direction] || []).map((port) => ({
        value: `${node.id}/${port.id}`,
        label: `${nodeLabel(node)} · ${port.id} (${port.type})`,
      })),
    );
  return (
    <section className="workflow-editor" aria-label="Éditeur de workflow">
      <div className="workflow-heading">
        <div>
          <p className="workflow-eyebrow">ATELIER IA / WORKFLOWS</p>
          <h3>Construisez votre mission</h3>
          <p>
            Brouillon en mémoire · exportez avant de fermer. Aucun moteur lancé depuis cet écran.
          </p>
        </div>
        <span className="workflow-status">Édition uniquement</span>
      </div>
      <div className="workflow-toolbar">
        <button type="button" onClick={validate}>
          Vérifier la structure
        </button>
        <button type="button" onClick={exportDraft}>
          Exporter le brouillon
        </button>
        <label className="workflow-file">
          Importer un fichier
          <input
            type="file"
            accept="application/json,.json"
            disabled={!canWrite}
            onChange={importFile}
          />
        </label>
        <label>
          Vue
          <select
            aria-label="Vue du workflow"
            value={flow.presentation.view}
            onChange={(e) =>
              setDraft((current) => ({
                ...current,
                workflow: {
                  ...current.workflow,
                  presentation: {
                    ...current.workflow.presentation,
                    view: e.target.value as "simple" | "advanced",
                  },
                },
              }))
            }
          >
            <option value="simple">Simple</option>
            <option value="advanced">Avancée</option>
          </select>
        </label>
      </div>
      <details className="workflow-start">
        <summary>Commencer depuis une consigne, un modèle ou un canevas</summary>
        <label>
          Point de départ
          <select value={entry} onChange={(e) => setEntry(e.target.value as typeof entry)}>
            <option value="chat">Consigne</option>
            <option value="template">Modèle guidé</option>
            <option value="canvas">Canevas manuel</option>
          </select>
        </label>
        {entry === "template" ? (
          <div className="workflow-recipes">
            {recipes.map(([id, label]) => (
              <button
                type="button"
                key={id}
                disabled={!canWrite}
                onClick={() => chooseRecipe(id, "template")}
              >
                {label}
              </button>
            ))}
          </div>
        ) : entry === "chat" ? (
          <div>
            <label>
              Votre consigne
              <textarea
                value={prompt}
                maxLength={2000}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </label>
            <p>
              La consigne initialise un parcours textuel ; aucune IA n’interprète ou n’exécute votre
              demande ici.
            </p>
            <button
              type="button"
              disabled={!canWrite || prompt.trim().length < 10}
              onClick={() => chooseRecipe("generalHermes", "chat")}
            >
              Créer le brouillon
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!canWrite}
            onClick={() => chooseRecipe("generalHermes", "canvas")}
          >
            Créer un parcours manuel sans moteur
          </button>
        )}
      </details>
      <div role="status" className="workflow-feedback">
        {notice || "Reliez les blocs puis vérifiez la structure."}
      </div>
      {issues !== null && issues.length > 0 && (
        <ul className="workflow-errors">
          {issues.slice(0, 12).map((issue, index) => (
            <li key={index}>
              {messages[issue.code] ||
                "Structure incompatible : vérifiez les blocs et leurs connexions."}
              {issue.nodeId &&
                ` Bloc : ${nodeLabel(flow.nodes.find((n) => n.id === issue.nodeId)!)}`}
            </li>
          ))}
        </ul>
      )}
      <div className="workflow-layout">
        <div className="workflow-map" aria-label="Canevas nodal">
          <ReactFlow<FlowNode>
            nodes={nodes}
            edges={flow.edges.map((edge) => ({
              id: edge.id,
              source: edge.from.nodeId,
              sourceHandle: edge.from.portId,
              target: edge.to.nodeId,
              targetHandle: edge.to.portId,
            }))}
            nodeTypes={nodeTypes}
            onNodeClick={(_: React.MouseEvent, node: FlowNode) => setSelected(node.id)}
            onNodesChange={(changes: NodeChange<FlowNode>[]) => {
              if (!canWrite) return;
              const moved = changes.filter(
                (change): change is Extract<NodeChange<FlowNode>, { type: "position" }> =>
                  change.type === "position" && !!change.position,
              );
              if (!moved.length) return;
              setDraft((current) => ({
                ...current,
                workflow: {
                  ...current.workflow,
                  presentation: {
                    ...current.workflow.presentation,
                    positions: current.workflow.nodes.map((node, index) => {
                      const change = moved.find((item) => item.id === node.id);
                      const position = change?.type === "position" ? change.position : undefined;
                      const saved = current.workflow.presentation.positions.find(
                        (item) => item.nodeId === node.id,
                      );
                      return {
                        nodeId: node.id,
                        x: Math.max(
                          -100000,
                          Math.min(100000, position?.x ?? saved?.x ?? index * 250),
                        ),
                        y: Math.max(-100000, Math.min(100000, position?.y ?? saved?.y ?? 0)),
                      };
                    }),
                  },
                },
              }));
            }}
            nodesDraggable={canWrite}
            nodesConnectable={canWrite}
            onConnect={connect}
            deleteKeyCode={null}
            onNodeDragStop={(_: MouseEvent | TouchEvent, node: FlowNode) =>
              update(
                {
                  ...draft,
                  workflow: {
                    ...flow,
                    presentation: {
                      ...flow.presentation,
                      positions: [
                        ...flow.presentation.positions.filter((p) => p.nodeId !== node.id),
                        {
                          nodeId: node.id,
                          x: Math.max(-100000, Math.min(100000, node.position.x)),
                          y: Math.max(-100000, Math.min(100000, node.position.y)),
                        },
                      ],
                    },
                  },
                },
                false,
              )
            }
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={1.5}
            colorMode="dark"
            ariaLabelConfig={{
              "controls.zoomIn.ariaLabel": "Agrandir le canevas",
              "controls.zoomOut.ariaLabel": "Réduire le canevas",
              "controls.fitView.ariaLabel": "Afficher tous les blocs",
              "controls.interactive.ariaLabel": "Activer ou verrouiller le déplacement",
            }}
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
        <aside className="workflow-inspector" aria-label="Configurer le workflow">
          <label>
            Nom du workflow
            <input
              value={flow.title}
              disabled={!canWrite}
              maxLength={120}
              onChange={(e) => changeGraph({ ...flow, title: e.target.value })}
            />
          </label>
          <label>
            Résultat attendu
            <textarea
              value={draft.mission.objective}
              disabled={!canWrite}
              maxLength={2000}
              onChange={(e) =>
                update(() => ({
                  ...editWorkflow(draft, flow),
                  mission: {
                    ...draft.mission,
                    workflow: { id: flow.id, revision: flow.revision + 1 },
                    objective: e.target.value,
                  },
                }))
              }
            />
          </label>
          <label>
            Autonomie de la mission
            <select
              value={draft.mission.policy.autonomy || ""}
              disabled={!canWrite}
              onChange={(e) => {
                update(() => {
                  const next = editWorkflow(draft, flow);
                  return {
                    ...next,
                    mission: {
                      ...next.mission,
                      policy: {
                        ...next.mission.policy,
                        autonomy: (e.target.value || null) as "prepare" | "scoped" | null,
                      },
                    },
                  };
                });
              }}
            >
              <option value="">À choisir avant exécution</option>
              <option value="prepare">Préparer et faire relire</option>
              <option value="scoped">Actions délimitées et approuvées</option>
            </select>
          </label>
          <p className="workflow-help">
            Budget API : 0 € · aucun repli payant. Le choix d’autonomie n’accorde aucune permission.
          </p>
          <label>
            Bloc à configurer
            <select value={selected} onChange={(e) => setSelected(e.target.value)}>
              {flow.nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {nodeLabel(node)}
                </option>
              ))}
            </select>
          </label>
          {chosen && (
            <>
              <NodeFields
                node={chosen}
                canWrite={canWrite}
                onChange={(node) => update(() => replaceDraftNode(draft, node))}
              />
              {advanced && (
                <p className="workflow-help">
                  ID : {chosen.id}
                  {chosen.kind === "capability" &&
                    ` · ${chosen.pluginId}@${chosen.pluginVersion} · ${chosen.capabilityId}`}
                </p>
              )}
              <button
                type="button"
                disabled={!canWrite || flow.nodes.length <= 2}
                onClick={() => {
                  update(() => removeDraftNode(draft, chosen.id));
                  setSelected(flow.nodes.find((n) => n.id !== chosen.id)!.id);
                }}
              >
                Retirer ce bloc
              </button>
            </>
          )}
        </aside>
      </div>
      <details className="workflow-connections" open={advanced}>
        <summary>Blocs et connexions · édition sans glisser-déposer</summary>
        <div className="workflow-add">
          <label>
            Ajouter un bloc
            <select
              aria-label="Ajouter un bloc"
              value={palette}
              onChange={(e) => setPalette(e.target.value)}
            >
              <option value="text">Consigne textuelle</option>
              <option value="transform">Préparer un document</option>
              <option value="review">Relecture humaine</option>
              <option value="deliverable">Livrable</option>
              {referencePluginContracts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <button type="button" disabled={!canWrite || flow.nodes.length >= 64} onClick={addNode}>
            Ajouter le bloc
          </button>
        </div>
        <form
          className="workflow-add"
          onSubmit={(e) => {
            e.preventDefault();
            const [sourceId, sourceHandle] = source.split("/"),
              [targetId, targetHandle] = target.split("/");
            connect({ source: sourceId, target: targetId, sourceHandle, targetHandle });
          }}
        >
          <label>
            Sortie
            <select aria-label="Sortie" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Choisir une sortie</option>
              {endpoints("outputs").map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Entrée
            <select aria-label="Entrée" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Choisir une entrée</option>
              {endpoints("inputs").map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={!canWrite || !source || !target || flow.edges.length >= 128}
          >
            Relier les blocs
          </button>
        </form>
        <ul>
          {flow.edges.map((edge, index) => (
            <li key={edge.id}>
              <span>
                {nodeLabel(flow.nodes.find((n) => n.id === edge.from.nodeId)!)} →{" "}
                {nodeLabel(flow.nodes.find((n) => n.id === edge.to.nodeId)!)}
                {advanced && ` · ${edge.from.portId} → ${edge.to.portId}`}
              </span>
              <button
                type="button"
                disabled={!canWrite}
                aria-label={`Retirer la connexion ${index + 1}`}
                onClick={() =>
                  changeGraph({ ...flow, edges: flow.edges.filter((e) => e.id !== edge.id) })
                }
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function NodeFields({
  node,
  canWrite,
  onChange,
}: {
  node: WorkflowNode;
  canWrite: boolean;
  onChange: (node: WorkflowNode) => void;
}) {
  if (node.kind === "human-review" || node.kind === "deliverable")
    return (
      <label>
        Libellé du bloc
        <input
          value={node.label}
          disabled={!canWrite}
          maxLength={120}
          onChange={(e) => onChange({ ...node, label: e.target.value })}
        />
      </label>
    );
  if (node.kind === "transform")
    return (
      <label>
        Préparation
        <select
          value={node.operation}
          disabled={!canWrite}
          onChange={(e) =>
            onChange({ ...node, operation: e.target.value as typeof node.operation })
          }
        >
          <option value="draft-text">Document à partir d’un texte</option>
          <option value="extract-text">Texte à partir d’un résultat</option>
          <option value="draft-team">Brief d’équipe</option>
        </select>
      </label>
    );
  if (node.kind === "capability")
    return (
      <p className="workflow-help">
        Ce bloc décrit une capacité. Son adaptateur de graphe et ses permissions seront vérifiés
        lors du raccordement du runtime.
      </p>
    );
  const value = node.value;
  if (value.type === "text")
    return (
      <label>
        Consigne du bloc
        <textarea
          value={value.text}
          disabled={!canWrite}
          maxLength={2000}
          onChange={(e) => onChange({ ...node, value: { ...value, text: e.target.value } })}
        />
      </label>
    );
  if (value.type === "audit-ref")
    return (
      <>
        {(["companyId", "auditId"] as const).map((key) => (
          <label key={key}>
            {key === "companyId"
              ? "Identifiant du dossier (UUID)"
              : "Identifiant de l’audit (UUID)"}
            <input
              value={value[key]}
              disabled={!canWrite}
              maxLength={36}
              onChange={(e) => onChange({ ...node, value: { ...value, [key]: e.target.value } })}
            />
          </label>
        ))}
        <label>
          Version du résultat
          <input
            type="number"
            min={1}
            max={1000000}
            value={value.resultVersion}
            disabled={!canWrite}
            onChange={(e) =>
              onChange({ ...node, value: { ...value, resultVersion: Number(e.target.value) } })
            }
          />
        </label>
        <p className="workflow-help">
          Les identifiants des modèles sont fictifs. Aucun dossier réel n’est relié ici.
        </p>
      </>
    );
  if (value.type === "workflow-ref")
    return (
      <>
        <label>
          Référence de connexion n8n (UUID)
          <input
            value={value.connectionRef}
            disabled={!canWrite}
            maxLength={36}
            onChange={(e) =>
              onChange({ ...node, value: { ...value, connectionRef: e.target.value } })
            }
          />
        </label>
        <label>
          Identifiant du workflow n8n
          <input
            value={value.workflowId}
            disabled={!canWrite}
            maxLength={128}
            onChange={(e) => onChange({ ...node, value: { ...value, workflowId: e.target.value } })}
          />
        </label>
      </>
    );
  return (
    <>
      <label>
        Objectif de l’équipe
        <textarea
          value={value.objective}
          disabled={!canWrite}
          maxLength={2000}
          onChange={(e) => onChange({ ...node, value: { ...value, objective: e.target.value } })}
        />
      </label>
      {value.agents.map((agent, index) => (
        <fieldset key={index}>
          <legend>Agent {index + 1}</legend>
          {(["name", "role"] as const).map((key) => (
            <label key={key}>
              {key === "name" ? "Nom" : "Responsabilité"}
              <input
                value={agent[key]}
                disabled={!canWrite}
                maxLength={key === "name" ? 80 : 160}
                onChange={(e) =>
                  onChange({
                    ...node,
                    value: {
                      ...value,
                      agents: value.agents.map((a, i) =>
                        i === index ? { ...a, [key]: e.target.value } : a,
                      ),
                    },
                  })
                }
              />
            </label>
          ))}
        </fieldset>
      ))}
    </>
  );
}
