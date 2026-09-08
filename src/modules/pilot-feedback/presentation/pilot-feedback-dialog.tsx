"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, MessageSquareText, X } from "lucide-react";
import type { PilotFeedbackInput, PilotFeedbackView } from "../application/pilot-feedback-schema";

const questions = [
  ["understandingScore", "L’audit reflète-t-il bien votre entreprise ?"],
  ["recommendationRelevanceScore", "Les recommandations vous semblent-elles pertinentes ?"],
  [
    "roiCredibilityScore",
    "Les estimations et conclusions économiques vous semblent-elles crédibles ?",
  ],
  ["nextStepClarityScore", "Savez-vous clairement quoi faire ensuite ?"],
  ["experienceScore", "Comment évaluez-vous votre expérience globale avec Optivos ?"],
] as const;

type FeedbackState = "loading" | "ready" | "submitted" | "error";

export function PilotFeedbackDialog({ companyId }: { readonly companyId?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [feedback, setFeedback] = useState<PilotFeedbackView | null>(null);
  const [state, setState] = useState<FeedbackState>(companyId ? "loading" : "ready");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!companyId) return;
    const controller = new AbortController();
    void fetch(`/api/pilot-feedback?companyId=${encodeURIComponent(companyId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as { data?: PilotFeedbackView | null };
        if (!response.ok) throw new Error("Impossible de charger votre avis.");
        setFeedback(payload.data ?? null);
        setState("ready");
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setMessage("Votre avis reste disponible, mais son état n’a pas pu être chargé.");
        setState("error");
      });
    return () => controller.abort();
  }, [companyId]);

  function open() {
    if (state === "submitted") setState("ready");
    dialog.current?.showModal();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!companyId) return;
    const form = new FormData(event.currentTarget);
    const priceText = String(form.get("acceptablePrice") ?? "").trim();
    const currency = String(form.get("priceCurrency") ?? "").trim();
    const input: PilotFeedbackInput = {
      companyId,
      understandingScore: Number(form.get("understandingScore")),
      recommendationRelevanceScore: Number(form.get("recommendationRelevanceScore")),
      roiCredibilityScore: Number(form.get("roiCredibilityScore")),
      nextStepClarityScore: Number(form.get("nextStepClarityScore")),
      experienceScore: Number(form.get("experienceScore")),
      willingToPay: String(form.get("willingToPay")) as PilotFeedbackInput["willingToPay"],
      ...(priceText ? { acceptablePrice: Number(priceText), priceCurrency: currency } : {}),
      comment: String(form.get("comment") ?? "").trim() || undefined,
    };
    setState("loading");
    const response = await fetch("/api/pilot-feedback", {
      method: feedback ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = (await response.json()) as {
      data?: PilotFeedbackView;
      error?: { message?: string };
    };
    if (!response.ok || !payload.data) {
      setMessage(payload.error?.message ?? "Votre avis n’a pas pu être enregistré.");
      setState("error");
      return;
    }
    setFeedback(payload.data);
    setState("submitted");
  }

  return (
    <>
      <button
        className="pilot-feedback-trigger inline-flex min-h-11 flex-wrap items-center justify-center gap-2 rounded-xl border border-slate-500 px-4 py-3 text-sm font-semibold text-slate-100 outline hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-blue-400 disabled:opacity-60"
        type="button"
        disabled={!companyId || state === "loading"}
        title={!companyId ? "Créez d’abord votre entreprise pour donner votre avis" : undefined}
        onClick={open}
      >
        <MessageSquareText size={17} />
        {feedback ? "Modifier mon avis" : "Donner mon avis"}
        {companyId && <span className="rounded-full bg-blue-500/15 px-2 py-1 text-xs">2 min</span>}
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="pilot-feedback-title"
        className="m-auto max-h-[92vh] w-[min(44rem,calc(100%-2rem))] overflow-y-auto rounded-[1.75rem] border border-slate-700 bg-slate-950 p-0 text-slate-50 shadow-2xl backdrop:bg-slate-950/80"
        onCancel={() => dialog.current?.close()}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-slate-950/95 p-5 backdrop-blur">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-blue-300 uppercase">
              Votre avis · 2 min
            </p>
            <h2 id="pilot-feedback-title" className="mt-1 text-2xl font-bold">
              Aidez-nous à améliorer Optivos
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Votre retour nous aide à améliorer Optivos avant son lancement.
            </p>
          </div>
          <button
            className="rounded-full p-2 hover:bg-white/10"
            type="button"
            aria-label="Fermer"
            onClick={() => dialog.current?.close()}
          >
            <X />
          </button>
        </header>

        {state === "submitted" ? (
          <section className="p-8 text-center">
            <CheckCircle2 className="mx-auto size-12 text-emerald-400" />
            <h3 className="mt-4 text-2xl font-bold">Merci pour votre retour.</h3>
            <p className="mt-2 text-slate-300">Votre avis nous aide à améliorer Optivos.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                className="rounded-xl border border-white/15 px-4 py-3 font-semibold"
                type="button"
                onClick={() => setState("ready")}
              >
                Modifier mon avis
              </button>
              <button
                className="rounded-xl bg-blue-500 px-4 py-3 font-semibold"
                type="button"
                onClick={() => dialog.current?.close()}
              >
                Terminer
              </button>
            </div>
          </section>
        ) : (
          <form
            className="space-y-6 p-5 sm:p-7"
            key={feedback?.updatedAt ?? "new"}
            onSubmit={submit}
          >
            {questions.map(([name, label]) => (
              <fieldset
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                key={name}
              >
                <legend className="px-1 font-semibold">{label}</legend>
                <div className="mt-3 grid grid-cols-5 gap-2" aria-label={`${label} Note de 1 à 5`}>
                  {[1, 2, 3, 4, 5].map((score) => (
                    <label className="cursor-pointer text-center" key={score}>
                      <input
                        className="peer sr-only"
                        type="radio"
                        name={name}
                        value={score}
                        defaultChecked={feedback?.[name] === score}
                        required
                      />
                      <span className="block rounded-xl border border-white/15 px-2 py-3 font-bold peer-checked:border-blue-400 peer-checked:bg-blue-500/20 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-300">
                        {score}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}

            <fieldset>
              <legend className="font-semibold">
                Envisageriez-vous de payer pour utiliser Optivos ?
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {[
                  ["YES", "Oui"],
                  ["NO", "Non"],
                  ["UNSURE", "Je ne sais pas encore"],
                ].map(([value, label]) => (
                  <label className="cursor-pointer" key={value}>
                    <input
                      className="peer sr-only"
                      type="radio"
                      name="willingToPay"
                      value={value}
                      defaultChecked={feedback?.willingToPay === value}
                      required
                    />
                    <span className="block rounded-xl border border-white/15 p-3 text-center peer-checked:border-blue-400 peer-checked:bg-blue-500/20 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-300">
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <details className="rounded-2xl border border-white/10 p-4">
              <summary className="cursor-pointer font-semibold">
                Préciser un prix acceptable (optionnel)
              </summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_8rem]">
                <label>
                  Montant
                  <input
                    className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2"
                    name="acceptablePrice"
                    type="number"
                    min="0.01"
                    step="0.01"
                    defaultValue={feedback?.acceptablePrice}
                  />
                </label>
                <label>
                  Devise
                  <input
                    className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 uppercase"
                    name="priceCurrency"
                    maxLength={3}
                    defaultValue={feedback?.priceCurrency ?? "EUR"}
                  />
                </label>
              </div>
            </details>

            <label className="block font-semibold">
              Un commentaire à partager ?{" "}
              <span className="font-normal text-slate-400">(optionnel)</span>
              <textarea
                className="mt-2 min-h-28 w-full rounded-2xl border border-white/15 bg-slate-900 p-3 font-normal"
                name="comment"
                maxLength={2000}
                defaultValue={feedback?.comment}
              />
            </label>

            {message && (
              <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">
                {message}
              </p>
            )}
            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-white/10 bg-slate-950 py-4">
              <button
                className="rounded-xl border border-white/15 px-4 py-3 font-semibold"
                type="button"
                onClick={() => dialog.current?.close()}
              >
                Plus tard
              </button>
              <button
                className="rounded-xl bg-blue-500 px-5 py-3 font-bold disabled:opacity-60"
                type="submit"
                disabled={state === "loading"}
              >
                {state === "loading"
                  ? "Enregistrement…"
                  : feedback
                    ? "Enregistrer les modifications"
                    : "Envoyer mon avis"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
