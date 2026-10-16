"use client";
import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Plus, Sparkles, SlidersHorizontal } from "lucide-react";
import {
  agentCompanyInputSchema,
  teamTemplates,
  type AgentCompanyInput,
} from "../domain/agent-company";
import { AgentAvatar } from "./agent-avatar";

type SetupValues = Omit<AgentCompanyInput, "id">;
export function WorkspaceSetup({
  value,
  onChange,
  template,
  onTemplate,
  companies,
  disabled,
  saving,
  onSubmit,
}: {
  value: SetupValues;
  onChange: (patch: Partial<SetupValues>) => void;
  template: keyof typeof teamTemplates;
  onTemplate: (value: keyof typeof teamTemplates) => void;
  companies: { id: string; name: string }[];
  disabled: boolean;
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  function move(next: number) {
    setError("");
    setStep(next);
    requestAnimationFrame(() => title.current?.focus());
  }
  function proceed() {
    if (step === 0 && (value.name.trim().length < 2 || value.objective.trim().length < 10)) {
      setError(
        "Donnez un nom à l’espace et décrivez le résultat attendu en au moins 10 caractères.",
      );
      return;
    }
    if (step === 1) {
      const result = agentCompanyInputSchema
        .pick({ agents: true })
        .safeParse({ agents: value.agents });
      if (!result.success) {
        setError(
          "Chaque agent a besoin d’un nom distinct et d’une responsabilité d’au moins deux caractères.",
        );
        return;
      }
    }
    move(Math.min(2, step + 1));
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 2) {
      proceed();
      return;
    }
    if (
      !agentCompanyInputSchema.safeParse({ ...value, id: "00000000-0000-4000-8000-000000000001" })
        .success
    ) {
      setError(
        "La configuration est incomplète. Revenez aux étapes précédentes pour vérifier les champs.",
      );
      return;
    }
    onSubmit(event);
  }
  return (
    <div className="workspace-setup-scroll">
      <form className="workspace-setup" onSubmit={submit} noValidate>
        <div className="setup-kicker">
          <Sparkles size={16} aria-hidden="true" /> UN NOUVEL ESPACE DE TRAVAIL
        </div>
        <nav className="setup-steps" aria-label="Étapes de création">
          {["Objectif", "Équipe", "Vérification"].map((label, index) => (
            <button
              type="button"
              key={label}
              disabled={disabled || index > step}
              aria-current={index === step ? "step" : undefined}
              onClick={() => move(index)}
            >
              <span>{index < step ? <Check size={14} aria-hidden="true" /> : index + 1}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="setup-title">
          <h2 ref={title} tabIndex={-1}>
            {
              [
                "Qu’allons-nous accomplir ?",
                "Donnez un rôle à votre équipe.",
                "Tout commence par un objectif clair.",
              ][step]
            }
          </h2>
          <p>
            {
              [
                "Un espace rassemble votre objectif, vos agents et les résultats de leurs missions.",
                "Commencez avec une petite équipe. Vous gardez la main sur les actions autorisées.",
                "Vérifiez votre configuration. L’enregistrement ne démarre aucun agent.",
              ][step]
            }
          </p>
        </div>
        {error && (
          <p className="setup-error" role="alert">
            {error}
          </p>
        )}
        <fieldset disabled={disabled} className="setup-fields">
          {step === 0 && (
            <>
              <label>
                Nom de l’entreprise IA
                <input
                  autoComplete="off"
                  placeholder="Ex. Studio, équipe commerciale, projet personnel…"
                  value={value.name}
                  minLength={2}
                  maxLength={120}
                  onChange={(e) => onChange({ name: e.target.value })}
                />
              </label>
              <label>
                Quel résultat doit produire cette équipe ?
                <textarea
                  aria-label="Quel résultat doit produire cette équipe ?"
                  aria-describedby="setup-objective-hint"
                  placeholder="Décrivez ce que vous voulez obtenir, plutôt que les outils à utiliser."
                  value={value.objective}
                  rows={4}
                  minLength={10}
                  maxLength={2000}
                  onChange={(e) => onChange({ objective: e.target.value })}
                />
                <span id="setup-objective-hint" className="setup-field-hint">
                  Un résultat concret aidera les agents à préparer leur travail.
                </span>
              </label>
            </>
          )}
          {step === 1 && (
            <>
              <fieldset className="setup-mode">
                <legend>Comment voulez-vous composer l’équipe ?</legend>
                {[
                  ["guided", "Guidé"],
                  ["template", "À partir d’un modèle"],
                  ["manual", "Manuel"],
                ].map(([mode, label]) => (
                  <label key={mode}>
                    <input
                      type="radio"
                      name="creation-mode"
                      checked={value.mode === mode}
                      onChange={() =>
                        onChange({
                          mode: mode as SetupValues["mode"],
                          agents: teamTemplates[mode === "template" ? template : "general"].map(
                            (a) => ({ ...a }),
                          ),
                        })
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>
              {value.mode === "template" && (
                <label>
                  Modèle d’équipe
                  <select
                    aria-label="Modèle d’équipe"
                    value={template}
                    onChange={(e) => {
                      const next = e.target.value as keyof typeof teamTemplates;
                      onTemplate(next);
                      onChange({ agents: teamTemplates[next].map((a) => ({ ...a })) });
                    }}
                  >
                    <option value="general">Équipe généraliste</option>
                    <option value="research">Recherche et rapports</option>
                    <option value="content">Création de contenu</option>
                  </select>
                </label>
              )}
              <div className="setup-agent-list">
                {value.agents.map((agent, index) => (
                  <div className="setup-agent" key={index}>
                    <div className="setup-agent-header">
                      <AgentAvatar variant={index} size={40} />
                      <span>{index === 0 ? "Coordination" : "Spécialiste"}</span>
                      {index > 0 && (
                        <button
                          type="button"
                          aria-label={`Retirer l’agent ${index + 1}`}
                          onClick={() =>
                            onChange({ agents: value.agents.filter((_, i) => i !== index) })
                          }
                        >
                          Retirer
                        </button>
                      )}
                    </div>
                    <div className="setup-agent-fields">
                      <label>
                        Nom de l’agent {index + 1}
                        <input
                          value={agent.name}
                          minLength={2}
                          maxLength={80}
                          onChange={(e) =>
                            onChange({
                              agents: value.agents.map((a, i) =>
                                i === index ? { ...a, name: e.target.value } : a,
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        Responsabilité de l’agent {index + 1}
                        <input
                          value={agent.role}
                          minLength={2}
                          maxLength={160}
                          onChange={(e) =>
                            onChange({
                              agents: value.agents.map((a, i) =>
                                i === index ? { ...a, role: e.target.value } : a,
                              ),
                            })
                          }
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="setup-add-agent"
                type="button"
                disabled={value.agents.length >= 3}
                onClick={() => onChange({ agents: [...value.agents, { name: "", role: "" }] })}
              >
                <Plus size={16} aria-hidden="true" />
                Ajouter un agent
              </button>
              <p className="setup-field-hint">
                Trois profils maximum pour ce pilote. Les rôles décrivent l’équipe souhaitée.
              </p>
            </>
          )}
          {step === 2 && (
            <>
              <div className="setup-review">
                <div>
                  <span>Votre espace</span>
                  <strong>{value.name}</strong>
                  <p>{value.objective}</p>
                </div>
                <div>
                  <span>Votre équipe</span>
                  <div className="setup-review-agents">
                    {value.agents.map((agent, index) => (
                      <div key={index}>
                        <AgentAvatar variant={index} size={32} />
                        <span>{agent.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="setup-review-footer">
                  <span>Budget API du pilote</span>
                  <strong>0 €</strong>
                </div>
              </div>
              <details className="setup-advanced">
                <summary>
                  <SlidersHorizontal size={16} aria-hidden="true" />
                  Configurer les autorisations et le module audit
                </summary>
                <label htmlFor="agent-company-autonomy">Autonomie souhaitée au raccordement</label>
                <select
                  id="agent-company-autonomy"
                  value={value.autonomy}
                  onChange={(e) =>
                    onChange({ autonomy: e.target.value as SetupValues["autonomy"] })
                  }
                >
                  <option value="approval">Validation préalable des actions importantes</option>
                  <option value="scoped">Actions précises autorisées à l’avance</option>
                  <option value="bounded">Autonomie avec limites définies</option>
                </select>
                <label htmlFor="agent-company-audit">Lien avec un dossier Optivos</label>
                <select
                  id="agent-company-audit"
                  value={value.companyId || ""}
                  onChange={(e) => onChange({ companyId: e.target.value || null })}
                >
                  <option value="">Espace indépendant — relier plus tard</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
                <p>
                  Le module audit est facultatif. Ce choix n’accorde aucun accès externe aux agents.
                </p>
              </details>
            </>
          )}
        </fieldset>
        <footer className="setup-footer">
          <span>Étape {step + 1} sur 3</span>
          <div>
            {step > 0 && (
              <button type="button" disabled={disabled} onClick={() => move(step - 1)}>
                <ArrowLeft size={16} aria-hidden="true" />
                Retour
              </button>
            )}
            <button className="setup-primary" type="submit" disabled={disabled}>
              {saving
                ? "Enregistrement…"
                : step === 2
                  ? "Enregistrer l’entreprise IA"
                  : "Continuer"}
              {step < 2 && <ArrowRight size={16} aria-hidden="true" />}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
