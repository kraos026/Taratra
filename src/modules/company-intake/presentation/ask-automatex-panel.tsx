"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AskAutomateXIntent, AskAutomateXResponse } from "../application/ask-automatex";
import type { PatronDecisionCenter } from "../application/patron-decision-center";

export function AskAutomateXPanel({ center }: { readonly center: PatronDecisionCenter }) {
  const suggestions = useMemo(() => suggestedAskQuestions(center), [center]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskAutomateXResponse | null>(null);
  const [previousIntent, setPreviousIntent] = useState<AskAutomateXIntent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (center.status === "UNAVAILABLE")
    return (
      <p className="rounded-lg border border-dashed border-slate-700 bg-slate-950/50 p-3 text-sm text-slate-400">
        Ask AutomateX becomes available after an ExecutiveDecisionView is published.
      </p>
    );

  async function submit(nextQuestion = question) {
    const trimmed = nextQuestion.trim();
    if (!trimmed || !center.sourceView) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/companies/${center.sourceView.company.id}/automation-audit/ask`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            question: trimmed,
            context: {
              previousIntent: previousIntent ?? undefined,
              previousBrainRunId: center.sourceView.traceability.brainRunId,
            },
          }),
        },
      );
      const payload = (await response.json()) as
        | { readonly success: true; readonly data: AskAutomateXResponse }
        | { readonly success: false; readonly error: { readonly message: string } };
      if (!payload.success) throw new Error(payload.error.message);
      setAnswer(payload.data);
      setPreviousIntent(payload.data.intent);
      setQuestion("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ask AutomateX is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="text-sm font-medium text-slate-200" htmlFor="ask-automatex-question">
          Your question
        </label>
        <Textarea
          id="ask-automatex-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Example: Why shouldn't we automate this control?"
          className="border-blue-900/60 bg-slate-950/80 text-slate-50 placeholder:text-slate-500"
        />
        <Button
          type="submit"
          disabled={loading || !question.trim()}
          className="w-fit bg-blue-600 hover:bg-blue-500"
        >
          {loading ? "Asking..." : "Ask AutomateX"}
        </Button>
      </form>

      <div className="grid gap-2 md:grid-cols-3">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => void submit(suggestion)}
            disabled={loading}
            className="rounded-lg border border-blue-900/60 bg-slate-950/60 p-3 text-left text-sm text-blue-100 transition hover:border-blue-500 hover:bg-blue-950/70 disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100"
        >
          {error}
        </p>
      ) : null}

      {answer ? <AskAnswer answer={answer} /> : null}
    </div>
  );
}

function AskAnswer({ answer }: { readonly answer: AskAutomateXResponse }) {
  return (
    <article className="rounded-xl border border-blue-900/60 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-100">
          {answer.answerStatus.replaceAll("_", " ")}
        </span>
        {answer.authoritativeDecisionState ? (
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-100">
            {answer.authoritativeDecisionState.replaceAll("_", " ")}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-sm leading-6 whitespace-pre-wrap text-slate-100">{answer.answer}</p>
      {answer.unknowns.length || answer.contradictions.length ? (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-sm font-semibold text-amber-100">Uncertainty remains visible</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-50">
            {[...answer.unknowns, ...answer.contradictions].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {answer.supportingEvidence.length ? (
        <details className="mt-4 rounded-lg border border-slate-800 bg-slate-900/80 p-3">
          <summary className="cursor-pointer font-semibold text-blue-200">View evidence</summary>
          <ul className="mt-2 space-y-2 text-sm text-slate-300">
            {answer.supportingEvidence.map((evidence) => (
              <li key={`${evidence.label}:${evidence.supports}`}>
                {evidence.label} — {evidence.supports}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </article>
  );
}

function suggestedAskQuestions(center: PatronDecisionCenter): readonly string[] {
  const questions = [
    "Why is this the top problem?",
    "What evidence supports this?",
    "What is still uncertain?",
    "What should we fix first?",
    "What would change this decision?",
    center.doNotAutomate.length ? "Why should we not automate this?" : "What can we automate?",
    "What other options exist?",
    "Is this economically justified?",
  ];
  return Object.freeze(questions.slice(0, 6));
}
