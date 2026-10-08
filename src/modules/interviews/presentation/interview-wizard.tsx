"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  interviewDomainLabel,
  isInterviewReadOnly,
  interviewAnswerLabel,
  interviewChoiceLabel,
  interviewErrorLabel,
  interviewReviewSummary,
  interviewConfidenceLabel,
} from "./interview-copy";
import { DocumentReview } from "./document-review";
import type { DocumentSource } from "../domain/document-source";

type Question = {
  id: string;
  code: string;
  domain: string;
  prompt: string;
  answerType: string;
  options: unknown;
  mandatory: boolean;
};
type InterviewView = {
  session: { id: string; lockVersion: number; status: string };
  nextQuestion: Question | null;
  progress: {
    progressPercentage: number;
    confidencePercentage: number;
    missingMandatory: string[];
    readyForProcessMapping: boolean;
    domains: {
      domain: string;
      progressPercentage: number;
      confidencePercentage: number;
    }[];
  };
  answers: {
    questionId: string;
    value: unknown;
    confidence: string;
    documentSource?: DocumentSource;
  }[];
  questions: Question[];
};

export function InterviewWizard({ companyId }: { companyId: string }) {
  const [view, setView] = useState<InterviewView | null>(null);
  const [value, setValue] = useState("");
  const [confidence, setConfidence] = useState<"confirmed" | "uncertain">("confirmed");
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [sourceAttachment, setSourceAttachment] = useState<{
    companyId: string;
    questionId: string;
    source: DocumentSource;
  } | null>(null);
  const documentSource =
    sourceAttachment?.companyId === companyId &&
    sourceAttachment.questionId === view?.nextQuestion?.id
      ? sourceAttachment.source
      : null;

  useEffect(() => {
    fetch(`/api/companies/${companyId}/interviews`)
      .then(async (response) => {
        if (response.status === 404) return null;
        return readView(response);
      })
      .then((next) => {
        setView(next);
        if (!next) setMessage("Aucun entretien actif. Démarrez un entretien si nécessaire.");
      })
      .catch((error: unknown) =>
        setMessage(error instanceof Error ? error.message : "Impossible de charger l’entretien"),
      )
      .finally(() => setBusy(false));
  }, [companyId]);

  async function startInterview() {
    setBusy(true);
    setMessage("Démarrage…");
    try {
      const response = await fetch(`/api/companies/${companyId}/interviews`, { method: "POST" });
      setView(await readView(response));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de démarrer l’entretien");
    } finally {
      setBusy(false);
    }
  }

  async function act(path: string, body?: object) {
    if (!view || isInterviewReadOnly(view.session.status)) return;
    setBusy(true);
    setMessage("Enregistrement…");
    try {
      const response = await fetch(`/api/interviews/${view.session.id}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const next = await readView(response);
      setView(next);
      setValue("");
      setSourceAttachment(null);
      setMessage("Enregistré");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Une erreur est survenue");
    } finally {
      setBusy(false);
    }
  }

  if (busy && !view) return <InterviewSkeleton />;
  if (!view)
    return (
      <div role="status" className="mx-auto max-w-5xl space-y-4 rounded-xl border p-6">
        <p>
          {message ||
            "Entretien indisponible. Vérifiez que les informations de votre entreprise sont validées."}
        </p>
        <Button disabled={busy} onClick={startInterview}>
          Démarrer l’entretien
        </Button>
      </div>
    );

  const question = view.nextQuestion;
  const readOnly = isInterviewReadOnly(view.session.status);
  const review = interviewReviewSummary(view.questions, view.answers, view.progress);
  return (
    <main className="mx-auto max-w-5xl space-y-5 text-slate-50">
      <header className="space-y-2">
        <Link
          className="inline-flex min-h-11 items-center text-sm text-blue-300"
          href={`/companies/${companyId}/automation-audit`}
        >
          ← Retour à l’audit
        </Link>
        <p className="text-xs font-semibold tracking-wider text-blue-300">
          VOTRE TRAVAIL AU QUOTIDIEN
        </p>
        <h1 className="text-3xl font-bold">Entretien guidé</h1>
        <p className="text-slate-300">
          {readOnly
            ? "Vos réponses sont validées et restent consultables ici."
            : "Quelques questions adaptées à votre activité. Répondez avec ce que vous savez ; vous pourrez reprendre plus tard."}
        </p>
      </header>

      <section aria-label="Progression globale" className="grid gap-4 sm:grid-cols-3">
        <Metric label="Réponses enregistrées" value={String(view.answers.length)} />
        <Metric label="Informations à confirmer" value={String(review.pendingCount)} />
        <Metric
          label="Suite de l’audit"
          value={
            readOnly
              ? "Entretien validé"
              : view.progress.readyForProcessMapping
                ? "Prête à examiner"
                : "À compléter"
          }
        />
      </section>

      <div className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className="h-full bg-violet-600 transition-all"
          style={{ width: `${view.progress.progressPercentage}%` }}
        />
      </div>

      <nav aria-label="Domaines de l’entretien" className="flex flex-wrap gap-2">
        {view.progress.domains.map((domain) => (
          <span key={domain.domain} className="rounded-full border px-3 py-1 text-sm">
            {interviewDomainLabel(domain.domain)}
          </span>
        ))}
      </nav>

      {question && !readOnly ? (
        <Card className="border-white/10 bg-slate-900/80 text-slate-50">
          <CardHeader>
            <p className="text-xs font-semibold text-blue-300 uppercase">
              {interviewDomainLabel(question.domain)}
            </p>
            <CardTitle>{question.prompt}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <AnswerField question={question} value={value} setValue={setValue} />
            {documentSource && (
              <div className="rounded-xl border border-blue-400/20 bg-blue-950/20 p-3 text-sm">
                <p>
                  Source relue : {documentSource.fileName} · {documentSource.location}
                </p>
                <p className="mt-1 text-slate-300">
                  Relisez votre réponse. La source documente votre déclaration ; elle ne garantit
                  pas son exactitude.
                </p>
                <Button variant="outline" disabled={busy} onClick={() => setSourceAttachment(null)}>
                  Ne pas joindre cet extrait
                </Button>
              </div>
            )}
            {["short_text", "long_text"].includes(question.answerType) && (
              <DocumentReview
                key={`${companyId}:${question.id}`}
                disabled={busy}
                onSelect={(source) => {
                  setValue(source.excerpt);
                  setSourceAttachment({ companyId, questionId: question.id, source });
                  setConfidence("uncertain");
                }}
              />
            )}
            <div className="space-y-2">
              <Label htmlFor="confidence">Niveau de certitude</Label>
              <select
                id="confidence"
                value={confidence}
                onChange={(event) => setConfidence(event.target.value as "confirmed" | "uncertain")}
                className="h-11 w-full rounded-md border border-slate-600 bg-slate-950 px-3 text-slate-50"
              >
                <option value="confirmed">Réponse confirmée</option>
                <option value="uncertain">Réponse incertaine</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={busy || value.trim() === ""}
                onClick={() =>
                  act("answer", {
                    lockVersion: view.session.lockVersion,
                    questionId: question.id,
                    value: parseValue(question.answerType, value),
                    confidence,
                    ...(documentSource ? { documentSource } : {}),
                  })
                }
              >
                Enregistrer et continuer
              </Button>
              {(["irrelevant", "unknown", "deferred"] as const).map((reason) => (
                <Button
                  key={reason}
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    act("skip", {
                      lockVersion: view.session.lockVersion,
                      questionId: question.id,
                      reason,
                    })
                  }
                >
                  {reason === "irrelevant"
                    ? "Non pertinent"
                    : reason === "unknown"
                      ? "Inconnu"
                      : "Reporter"}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-white/10 bg-slate-900/80 text-slate-50">
          <CardHeader>
            <CardTitle>Revue de l’entretien</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{review.message}</p>
            {review.pendingCount > 0 && (
              <p className="rounded-xl border border-amber-400/30 bg-amber-950/20 p-3 text-amber-200">
                {review.pendingCount} information(s) restent à confirmer ou à compléter. Ces limites
                restent à prendre en compte dans la suite de l’audit ; aucun gain n’est démontré par
                la seule validation de l’entretien.
              </p>
            )}
            {readOnly ? (
              <Link
                className="opt-primary inline-flex min-h-11 items-center rounded-xl px-4 py-3 text-sm font-semibold"
                href={`/companies/${companyId}/automation-audit`}
              >
                Voir la suite de l’audit
              </Link>
            ) : (
              <Button
                disabled={!view.progress.readyForProcessMapping || busy}
                onClick={() => act(view.session.status === "completed" ? "validate" : "complete")}
              >
                {view.session.status === "completed"
                  ? "Valider l’entretien et continuer"
                  : "Terminer l’entretien"}
              </Button>
            )}
            <div className="divide-y rounded-lg border">
              {view.answers.map((answer) => {
                const answeredQuestion = view.questions.find(
                  (candidate) => candidate.id === answer.questionId,
                );
                return (
                  <div
                    key={answer.questionId}
                    className="flex flex-wrap items-center justify-between gap-4 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{answeredQuestion?.prompt ?? "Question"}</p>
                      <p className="text-sm break-words text-slate-300">
                        {interviewAnswerLabel(answer.value, answeredQuestion)}
                      </p>
                      <p className="mt-1 text-xs text-blue-200">
                        {interviewConfidenceLabel(answer.value, answer.confidence)}
                      </p>
                      {answer.documentSource && (
                        <details className="mt-2 rounded-lg border border-blue-400/20 p-3 text-sm">
                          <summary className="cursor-pointer text-blue-300">
                            Source documentaire relue : {answer.documentSource.fileName} ·{" "}
                            {answer.documentSource.location}
                          </summary>
                          <p className="mt-2 break-words whitespace-pre-wrap text-slate-300">
                            {answer.documentSource.excerpt}
                          </p>
                          <p className="mt-2 text-xs text-slate-400">
                            Déclaration relue par l’utilisateur, non vérification indépendante du
                            document.
                          </p>
                        </details>
                      )}
                    </div>
                    {!readOnly && (
                      <Button
                        variant="outline"
                        className="opt-secondary"
                        disabled={busy}
                        onClick={() =>
                          act("back", {
                            lockVersion: view.session.lockVersion,
                            questionId: answer.questionId,
                          })
                        }
                      >
                        Modifier
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <p aria-live="polite" className="text-muted-foreground text-sm">
        {message ||
          (readOnly
            ? "Entretien validé · consultation seule"
            : "Vos réponses sont enregistrées à chaque étape.")}
      </p>
    </main>
  );
}

function AnswerField({
  question,
  value,
  setValue,
}: {
  question: Question;
  value: string;
  setValue: (value: string) => void;
}) {
  if (question.answerType === "multiple_choice" && Array.isArray(question.options)) {
    const selected = value.split(",").filter(Boolean);
    return (
      <fieldset className="space-y-2">
        <legend>Réponse — plusieurs choix possibles</legend>
        {question.options.map((option) => {
          const choice = String(option);
          return (
            <label key={choice} className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                value={choice}
                checked={selected.includes(choice)}
                onChange={(event) =>
                  setValue(
                    (event.target.checked
                      ? [...selected, choice]
                      : selected.filter((item) => item !== choice)
                    ).join(","),
                  )
                }
              />
              {interviewChoiceLabel(question.code, choice)}
            </label>
          );
        })}
      </fieldset>
    );
  }
  if (question.answerType === "boolean")
    return (
      <select
        aria-label="Réponse"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-11 w-full rounded-md border border-slate-600 bg-slate-950 px-3 text-slate-50"
      >
        <option value="">Sélectionner</option>
        <option value="true">Oui</option>
        <option value="false">Non</option>
      </select>
    );
  if (question.answerType === "single_choice" && Array.isArray(question.options))
    return (
      <select
        aria-label="Réponse"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-11 w-full rounded-md border border-slate-600 bg-slate-950 px-3 text-slate-50"
      >
        <option value="">Sélectionner</option>
        {question.options.map((option) => (
          <option key={String(option)} value={String(option)}>
            {interviewChoiceLabel(question.code, String(option))}
          </option>
        ))}
      </select>
    );
  if (question.answerType === "long_text")
    return (
      <Textarea
        aria-label="Réponse"
        className="border-slate-600 bg-slate-950 text-slate-50"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    );
  return (
    <Input
      aria-label="Réponse"
      className="border-slate-600 bg-slate-950 text-slate-50"
      type={question.answerType === "number" ? "number" : "text"}
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-white/10 bg-slate-900/80 text-slate-50">
      <CardContent className="pt-6">
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function parseValue(type: string, value: string) {
  if (type === "boolean") return value === "true";
  if (type === "number") return Number(value);
  if (type === "multiple_choice")
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  return value;
}

async function readView(response: Response): Promise<InterviewView> {
  const payload = (await response.json()) as {
    data?: InterviewView;
    error?: { message?: string };
  };
  if (!response.ok || !payload.data)
    throw new Error(
      interviewErrorLabel(payload.error?.message ?? "Impossible de charger l’entretien"),
    );
  return payload.data;
}

function InterviewSkeleton() {
  return (
    <div role="status" aria-label="Chargement de l’entretien" className="space-y-4">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-28 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800"
        />
      ))}
    </div>
  );
}
