"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const statusLabels = {
  draft: "Brouillon",
  in_progress: "En cours",
  completed: "Terminé",
  validated: "Validé",
  archived: "Archivé",
};
function errorMessage(error: unknown) {
  const code =
    error instanceof ConvexError && typeof error.data === "object" && error.data !== null
      ? error.data.code
      : undefined;
  if (code === "AUDIT_INCOMPLETE")
    return "Répondez à toutes les questions obligatoires avant de terminer l’audit.";
  if (code === "INVALID_ANSWER")
    return "Cette réponse ne respecte pas les contraintes de la question. Vérifiez le format et les limites indiquées.";
  if (code === "AUDIT_INVALID_STATE")
    return "Cet audit est verrouillé ou son entreprise n’est plus active.";
  if (code === "AUDIT_FORBIDDEN") return "Votre rôle ne permet pas cette action.";
  return "L’opération n’a pas abouti. Vérifiez les données affichées avant de réessayer.";
}
const selectClass =
  "min-h-10 w-full rounded-md border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:opacity-50";

export function CompanyAudits({
  companyId,
  name,
  onClose,
}: {
  companyId: string;
  name: string;
  onClose: () => void;
}) {
  const catalogues = useQuery(api.auditCatalogue.list);
  const audits = useQuery(api.audits.list, { companyId, pageSize: 100 });
  const create = useMutation(api.audits.create);
  const router = useRouter();
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState<string>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const versionId = String(new FormData(event.currentTarget).get("version") ?? "");
    setPending(true);
    setMessage(undefined);
    try {
      const audit = await create({ companyId, questionnaireVersionId: versionId });
      router.push(`/convex-pilot/audits/${audit.id}`);
    } catch (error) {
      setMessage(errorMessage(error));
      setPending(false);
    }
  }
  return (
    <section
      className="space-y-5 rounded-xl border border-blue-400/25 p-5"
      aria-label={`Audits de ${name}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Audits de {name}</h2>
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Fermer les audits
        </Button>
      </div>
      {catalogues === undefined || audits === undefined ? (
        <p role="status">Chargement des audits…</p>
      ) : (
        <>
          {audits.permissions.canWrite && (
            <form onSubmit={(event) => void submit(event)} className="space-y-3">
              <Label htmlFor="audit-version">Questionnaire publié</Label>
              <select
                className={selectClass}
                id="audit-version"
                name="version"
                required
                disabled={pending || catalogues.length === 0}
              >
                <option value="">Sélectionner un questionnaire…</option>
                {catalogues.map((catalogue) => (
                  <option key={catalogue.versionId} value={catalogue.versionId}>
                    {catalogue.name} — version {catalogue.versionNumber} ({catalogue.questions}{" "}
                    questions)
                  </option>
                ))}
              </select>
              <Button type="submit" disabled={pending || catalogues.length === 0}>
                {pending ? "Création…" : "Commencer l’audit"}
              </Button>
            </form>
          )}
          {catalogues.length === 0 && (
            <p role="status">
              Aucun questionnaire publié n’est encore disponible pour votre espace.
            </p>
          )}
          {message && (
            <p role="alert" className="text-amber-200">
              {message}
            </p>
          )}
          {audits.items.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun audit pour cette entreprise.</p>
          ) : (
            <ul className="space-y-3">
              {audits.items.map((audit) => (
                <li key={audit.id} className="rounded-lg border border-white/10 p-4">
                  <Link
                    className="font-medium text-blue-300 underline"
                    href={`/convex-pilot/audits/${audit.id}`}
                  >
                    {audit.questionnaireVersion?.template.name ?? "Audit"}
                  </Link>
                  <p className="mt-2 text-sm text-slate-400">
                    {statusLabels[audit.status]} · {audit.progressPercentage} % renseigné
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

type Detail = FunctionReturnType<typeof api.audits.get>;
type Question = NonNullable<
  Detail["item"]["questionnaireVersion"]
>["sections"][number]["questions"][number];

export function AuditWorkspace({ id }: { id: string }) {
  const detail = useQuery(api.audits.get, { id });
  const answer = useMutation(api.audits.answer),
    update = useMutation(api.audits.update),
    complete = useMutation(api.audits.complete),
    validate = useMutation(api.audits.validate);
  const [sectionId, setSectionId] = useState<string>(),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState<string>();
  const [dirty, setDirty] = useState<Set<string>>(() => new Set());
  const [confirmValidation, setConfirmValidation] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => {
      if (dirty.size || pending) event.preventDefault();
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [dirty.size, pending]);
  function setQuestionDirty(questionId: string, changed: boolean) {
    setDirty((previous) => {
      const next = new Set(previous);
      if (changed) next.add(questionId);
      else next.delete(questionId);
      return next;
    });
  }
  async function perform(operation: () => Promise<unknown>) {
    if (pending) return false;
    setPending(true);
    setMessage(undefined);
    try {
      await operation();
      return true;
    } catch (error) {
      setMessage(errorMessage(error));
      return false;
    } finally {
      setPending(false);
    }
  }
  if (!detail) return <p role="status">Chargement de l’audit…</p>;
  const { item, permissions } = detail,
    sections = item.questionnaireVersion?.sections ?? [];
  const selected = sectionId ?? item.currentSectionId ?? sections[0]?.id;
  const sectionIndex = Math.max(
    0,
    sections.findIndex((section) => section.id === selected),
  );
  const section = sections[sectionIndex];
  const saved = new Map(item.answers.map((value) => [value.questionId, value.valueJson]));
  const required = sections
    .flatMap((section) => section.questions)
    .filter((question) => question.required);
  const missing = required.filter((question) => !saved.has(question.id)).length;
  async function move(nextId: string) {
    if (permissions.canWrite && !(await perform(() => update({ id, currentSectionId: nextId }))))
      return;
    setSectionId(nextId);
  }
  return (
    <div className="space-y-7">
      <Link
        href="/convex-pilot"
        className="text-sm text-blue-300 underline"
        onClick={(event) => {
          if (dirty.size || pending) {
            event.preventDefault();
            setMessage("Enregistrez ou annulez vos modifications avant de quitter.");
          }
        }}
      >
        ← Vos entreprises
      </Link>
      <header className="space-y-3">
        <p className="text-sm text-slate-400">{item.company.name}</p>
        <h1 className="text-2xl font-semibold">
          {item.questionnaireVersion?.template.name ?? "Audit"}
        </h1>
        <p className="text-sm text-slate-300">
          {statusLabels[item.status]} · {item.progressPercentage} % renseigné · {missing} réponse
          {missing > 1 ? "s" : ""} obligatoire{missing > 1 ? "s" : ""} manquante
          {missing > 1 ? "s" : ""}
        </p>
        <progress
          aria-label="Progression de l’audit"
          value={item.progressPercentage}
          max={100}
          className="h-3 w-full accent-violet-500"
        />
      </header>
      <p className="text-sm text-slate-400">
        Vos réponses sont enregistrées dans votre espace. La validation les verrouille ; elle ne
        génère pas encore les opportunités ni le ROI.
      </p>
      {message && (
        <p role="alert" className="rounded-lg border border-amber-400/30 p-3 text-amber-200">
          {message}
        </p>
      )}
      {dirty.size > 0 && (
        <p role="status" className="text-sm text-amber-200">
          Des réponses sont modifiées. Enregistrez-les ou annulez avant de changer de section.
        </p>
      )}
      <div className="flex flex-wrap gap-3" aria-label="Affichage de l’audit">
        <Button
          variant="outline"
          disabled={pending || dirty.size > 0}
          aria-pressed={!showSummary}
          onClick={() => setShowSummary(false)}
        >
          Questionnaire
        </Button>
        <Button
          variant="outline"
          disabled={pending || dirty.size > 0}
          aria-pressed={showSummary}
          onClick={() => setShowSummary(true)}
        >
          Voir le résumé
        </Button>
      </div>
      {showSummary ? (
        <section className="space-y-5" aria-label="Résumé des réponses">
          <h2 className="text-xl font-semibold">Résumé des réponses</h2>
          {sections.map((summarySection) => (
            <section
              key={summarySection.id}
              className="space-y-4 rounded-xl border border-white/10 p-5"
            >
              <h3 className="font-medium">{summarySection.title}</h3>
              <dl className="space-y-4">
                {summarySection.questions.map((question) => {
                  const value = saved.get(question.id);
                  return (
                    <div key={question.id}>
                      <dt className="text-sm text-slate-400">{question.label}</dt>
                      <dd className="mt-1 break-words whitespace-pre-wrap">
                        {!saved.has(question.id)
                          ? "Non renseigné"
                          : typeof value === "boolean"
                            ? value
                              ? "Oui"
                              : "Non"
                            : Array.isArray(value)
                              ? value.map(String).join(", ") || "Aucun choix"
                              : String(value)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          ))}
        </section>
      ) : section ? (
        <section className="space-y-6 rounded-xl border border-white/10 p-5">
          <h2 className="text-xl font-medium">
            {section.position}. {section.title}
          </h2>
          {section.questions.map((question) => (
            <QuestionResponse
              key={question.id}
              question={question}
              initial={saved.get(question.id)}
              disabled={!permissions.canWrite || pending}
              onDirty={(changed) => setQuestionDirty(question.id, changed)}
              onSave={async (value) => {
                const success = await perform(() => answer({ id, questionId: question.id, value }));
                if (success) setQuestionDirty(question.id, false);
                return success;
              }}
            />
          ))}
        </section>
      ) : (
        <p>Aucune section disponible.</p>
      )}
      {!showSummary && (
        <nav
          className="flex flex-wrap items-center justify-between gap-3"
          aria-label="Sections du questionnaire"
        >
          <Button
            variant="outline"
            disabled={sectionIndex === 0 || pending || dirty.size > 0}
            onClick={() => void move(sections[sectionIndex - 1].id)}
          >
            Précédent
          </Button>
          <span className="text-sm text-slate-400">
            Section {sectionIndex + 1} / {sections.length}
          </span>
          <Button
            variant="outline"
            disabled={sectionIndex >= sections.length - 1 || pending || dirty.size > 0}
            onClick={() => void move(sections[sectionIndex + 1].id)}
          >
            Suivant
          </Button>
        </nav>
      )}
      {permissions.canWrite && (
        <Button
          disabled={pending || dirty.size > 0 || item.status === "completed"}
          onClick={() => void perform(() => complete({ id }))}
        >
          Terminer l’audit
        </Button>
      )}
      {permissions.canValidate && !confirmValidation && (
        <Button disabled={pending || dirty.size > 0} onClick={() => setConfirmValidation(true)}>
          Valider définitivement
        </Button>
      )}
      {confirmValidation && (
        <section className="space-y-3 rounded-xl border border-amber-400/30 p-5">
          <p>La validation verrouille les réponses de cet audit. Souhaitez-vous confirmer ?</p>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={pending || dirty.size > 0}
              onClick={() =>
                void perform(() => validate({ id })).then((success) => {
                  if (success) setConfirmValidation(false);
                })
              }
            >
              Confirmer la validation
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setConfirmValidation(false)}
            >
              Annuler
            </Button>
          </div>
        </section>
      )}
      {item.status === "validated" && (
        <p role="status" className="rounded-lg border border-emerald-400/25 p-4 text-emerald-200">
          Audit validé. Les réponses sont désormais en lecture seule.
        </p>
      )}
    </div>
  );
}

function QuestionResponse({
  question,
  initial,
  disabled,
  onDirty,
  onSave,
}: {
  question: Question;
  initial: unknown;
  disabled: boolean;
  onDirty: (changed: boolean) => void;
  onSave: (value: unknown) => Promise<boolean>;
}) {
  const [value, setValue] = useState<unknown>(initial),
    [state, setState] = useState<"idle" | "modified" | "saved" | "error">("idle");
  const options: unknown[] = Array.isArray(question.optionsJson) ? question.optionsJson : [];
  const rules =
    typeof question.validationJson === "object" &&
    question.validationJson !== null &&
    !Array.isArray(question.validationJson)
      ? question.validationJson
      : {};
  const minimum =
    typeof rules.min === "number"
      ? rules.min
      : question.questionType === "percentage" || question.questionType === "currency"
        ? 0
        : undefined;
  const maximum =
    typeof rules.max === "number"
      ? rules.max
      : question.questionType === "percentage"
        ? 100
        : undefined;
  function change(next: unknown) {
    setValue(next);
    setState("modified");
    onDirty(true);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let output = value;
    if (["number", "percentage", "currency"].includes(question.questionType)) {
      if (
        (typeof value !== "number" && typeof value !== "string") ||
        String(value).trim() === "" ||
        !Number.isFinite(Number(value))
      ) {
        setState("error");
        return;
      }
      output = Number(value);
    }
    if (
      output === undefined ||
      (question.questionType === "boolean" && typeof output !== "boolean")
    ) {
      setState("error");
      return;
    }
    setState((await onSave(output)) ? "saved" : "error");
  }
  const common = {
    id: question.id,
    disabled,
    required: question.required,
    "aria-describedby": `${question.id}-hint`,
  };
  const text = typeof value === "string" || typeof value === "number" ? value : "";
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="space-y-3 border-t border-white/10 pt-5"
    >
      <Label htmlFor={question.id}>
        {question.label}
        {question.required ? " *" : ""}
      </Label>
      <p id={`${question.id}-hint`} className="text-xs text-slate-400">
        {question.required ? "Obligatoire." : "Facultatif."}
        {minimum !== undefined ? ` Minimum : ${minimum}.` : ""}
        {maximum !== undefined ? ` Maximum : ${maximum}.` : ""}
        {typeof rules.minLength === "number" ? ` Au moins ${rules.minLength} caractères.` : ""}
        {typeof rules.maxLength === "number" ? ` ${rules.maxLength} caractères maximum.` : ""}
      </p>
      {question.questionType === "long_text" ? (
        <Textarea
          {...common}
          value={text}
          minLength={typeof rules.minLength === "number" ? rules.minLength : undefined}
          maxLength={typeof rules.maxLength === "number" ? rules.maxLength : undefined}
          onChange={(event) => change(event.target.value)}
        />
      ) : question.questionType === "boolean" ? (
        <select
          {...common}
          className={selectClass}
          value={typeof value === "boolean" ? String(value) : ""}
          onChange={(event) =>
            change(event.target.value === "" ? undefined : event.target.value === "true")
          }
        >
          <option value="">Sélectionner…</option>
          <option value="true">Oui</option>
          <option value="false">Non</option>
        </select>
      ) : ["single_choice", "multiple_choice"].includes(question.questionType) ? (
        <select
          {...common}
          className={selectClass}
          multiple={question.questionType === "multiple_choice"}
          value={
            question.questionType === "multiple_choice"
              ? options.flatMap((option, index) =>
                  Array.isArray(value) && value.includes(option) ? [String(index)] : [],
                )
              : value === undefined
                ? ""
                : String(options.indexOf(value))
          }
          onChange={(event) =>
            change(
              question.questionType === "multiple_choice"
                ? Array.from(
                    event.target.selectedOptions,
                    (option) => options[Number(option.value)],
                  )
                : event.target.value === ""
                  ? undefined
                  : options[Number(event.target.value)],
            )
          }
        >
          {question.questionType === "single_choice" && <option value="">Sélectionner…</option>}
          {options.map((option, index) => (
            <option key={index} value={String(index)}>
              {String(option)}
            </option>
          ))}
        </select>
      ) : (
        <Input
          {...common}
          type={
            ["number", "percentage", "currency"].includes(question.questionType)
              ? "number"
              : question.questionType === "date"
                ? "date"
                : "text"
          }
          step="any"
          min={minimum}
          max={maximum}
          value={text}
          onChange={(event) => change(event.target.value)}
        />
      )}
      <div className="flex flex-wrap items-center gap-3">
        {!disabled && (
          <>
            <Button type="submit">Enregistrer la réponse</Button>
            {state === "modified" || state === "error" ? (
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setValue(initial);
                  setState("idle");
                  onDirty(false);
                }}
              >
                Annuler
              </Button>
            ) : null}
          </>
        )}
        <span
          role="status"
          className={`text-xs ${state === "error" ? "text-amber-200" : "text-slate-400"}`}
        >
          {state === "saved"
            ? "Réponse enregistrée"
            : state === "error"
              ? "Réponse non enregistrée. Vérifiez le format."
              : initial !== undefined && state === "idle"
                ? "Réponse déjà enregistrée"
                : state === "modified"
                  ? "Non enregistré"
                  : ""}
        </span>
      </div>
    </form>
  );
}
