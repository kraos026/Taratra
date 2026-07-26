"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
  answers: { questionId: string; value: unknown; confidence: string }[];
  questions: Question[];
};

export function InterviewWizard({ companyId }: { companyId: string }) {
  const [view, setView] = useState<InterviewView | null>(null);
  const [value, setValue] = useState("");
  const [confidence, setConfidence] = useState<"confirmed" | "uncertain">("confirmed");
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/companies/${companyId}/interviews`, { method: "POST" })
      .then(readView)
      .then(setView)
      .catch((error: unknown) =>
        setMessage(error instanceof Error ? error.message : "Impossible de démarrer l’entretien"),
      )
      .finally(() => setBusy(false));
  }, [companyId]);

  async function act(path: string, body?: object) {
    if (!view) return;
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
      <div role="alert" className="rounded-xl border border-red-300 p-6">
        {message || "Entretien indisponible. Vérifiez que Discovery est validée."}
      </div>
    );

  const question = view.nextQuestion;
  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold tracking-wider text-violet-600">ADAPTIVE INTERVIEW</p>
        <h1 className="text-3xl font-bold">Entretien contextuel</h1>
        <p className="text-muted-foreground">
          Les questions s’adaptent aux données Discovery et aux réponses déjà confirmées.
        </p>
      </header>

      <section aria-label="Progression globale" className="grid gap-4 sm:grid-cols-3">
        <Metric label="Progression" value={`${view.progress.progressPercentage}%`} />
        <Metric label="Confiance" value={`${view.progress.confidencePercentage}%`} />
        <Metric
          label="Process Mapping"
          value={view.progress.readyForProcessMapping ? "Prêt" : "Informations manquantes"}
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
            {domain.domain}: {domain.progressPercentage}% · confiance {domain.confidencePercentage}%
          </span>
        ))}
      </nav>

      {question ? (
        <Card>
          <CardHeader>
            <p className="text-xs font-semibold text-violet-600 uppercase">{question.domain}</p>
            <CardTitle>{question.prompt}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <AnswerField question={question} value={value} setValue={setValue} />
            <div className="space-y-2">
              <Label htmlFor="confidence">Niveau de certitude</Label>
              <select
                id="confidence"
                value={confidence}
                onChange={(event) => setConfidence(event.target.value as "confirmed" | "uncertain")}
                className="bg-background h-10 w-full rounded-md border px-3"
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
        <Card>
          <CardHeader>
            <CardTitle>Revue de l’entretien</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              {view.progress.readyForProcessMapping
                ? "Toutes les informations obligatoires sont suffisamment fiables."
                : `${view.progress.missingMandatory.length} information(s) obligatoire(s) restent à confirmer.`}
            </p>
            <Button
              disabled={!view.progress.readyForProcessMapping || busy}
              onClick={() => act("complete")}
            >
              Terminer l’entretien
            </Button>
            <div className="divide-y rounded-lg border">
              {view.answers.map((answer) => {
                const answeredQuestion = view.questions.find(
                  (candidate) => candidate.id === answer.questionId,
                );
                return (
                  <div
                    key={answer.questionId}
                    className="flex items-center justify-between gap-4 p-3"
                  >
                    <div>
                      <p className="font-medium">{answeredQuestion?.prompt ?? "Question"}</p>
                      <p className="text-muted-foreground text-sm">
                        {answer.value === null ? "Sans réponse" : String(answer.value)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() =>
                        act("back", {
                          lockVersion: view.session.lockVersion,
                          questionId: answer.questionId,
                        })
                      }
                    >
                      Modifier
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <p aria-live="polite" className="text-muted-foreground text-sm">
        {message}
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
  if (question.answerType === "boolean")
    return (
      <select
        aria-label="Réponse"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="bg-background h-10 w-full rounded-md border px-3"
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
        className="bg-background h-10 w-full rounded-md border px-3"
      >
        <option value="">Sélectionner</option>
        {question.options.map((option) => (
          <option key={String(option)} value={String(option)}>
            {String(option)}
          </option>
        ))}
      </select>
    );
  if (question.answerType === "long_text")
    return (
      <Textarea
        aria-label="Réponse"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    );
  return (
    <Input
      aria-label="Réponse"
      type={question.answerType === "number" ? "number" : "text"}
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
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
    throw new Error(payload.error?.message ?? "Interview request failed");
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
