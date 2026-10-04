"use client";

import { useRef, useState } from "react";
import { FileText, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DocumentSource } from "../domain/document-source";
import {
  DOCUMENT_LIMITS,
  DocumentReadError,
  readDocumentText,
  type DocumentExcerpt,
} from "./document-reader";

export function DocumentReview({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (source: DocumentSource) => void;
}) {
  const [document, setDocument] = useState<{
    name: string;
    hash: string;
    excerpts: DocumentExcerpt[];
  } | null>(null);
  const [selected, setSelected] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  function clear(resetInput = true) {
    generation.current++;
    setDocument(null);
    setSelected("");
    setReviewed(false);
    setMessage("");
    setLoading(false);
    if (resetInput && fileInput.current) fileInput.current.value = "";
  }

  async function load(file: File | undefined) {
    clear(false);
    if (!file) return;
    const ticket = generation.current;
    setLoading(true);
    try {
      if (file.size > DOCUMENT_LIMITS.bytes)
        throw new DocumentReadError("Maximum 256 Ko par fichier.");
      if (!/\.(txt|csv)$/i.test(file.name))
        throw new DocumentReadError("Choisissez un fichier TXT ou CSV UTF-8.");
      const bytes = await file.arrayBuffer();
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        throw new DocumentReadError(
          "Encodage non pris en charge. Exportez votre document en UTF-8.",
        );
      }
      const excerpts = readDocumentText(file.name, text);
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const hash = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      if (ticket === generation.current) setDocument({ name: file.name, hash, excerpts });
    } catch (error) {
      if (ticket === generation.current)
        setMessage(
          error instanceof DocumentReadError
            ? error.message
            : "Lecture locale impossible. Réessayez avec un fichier TXT ou CSV UTF-8.",
        );
    } finally {
      if (ticket === generation.current) setLoading(false);
    }
  }

  const excerpt = document?.excerpts.find((entry) => entry.location === selected);
  return (
    <section
      aria-label="Documents d’appui"
      className="space-y-4 rounded-2xl border border-blue-400/20 bg-blue-950/20 p-5"
    >
      <div className="flex items-start gap-3">
        <FileText aria-hidden="true" className="mt-1 size-5 shrink-0 text-blue-300" />
        <div>
          <h3 className="font-semibold">Appuyez votre réponse sur un document</h3>
          <p className="mt-1 text-sm text-slate-300">
            Facultatif · TXT ou CSV UTF-8 · 256 Ko maximum. Aucun calcul ni interprétation
            automatique.
          </p>
        </div>
      </div>
      <ol
        aria-label="Étapes de l’import documentaire"
        className="grid gap-2 text-sm text-slate-300 sm:grid-cols-3"
      >
        <li className="rounded-lg border border-white/10 p-3">1. Choisir un document</li>
        <li className="rounded-lg border border-white/10 p-3">2. Relire un extrait</li>
        <li className="rounded-lg border border-white/10 p-3">3. Enregistrer la réponse</li>
      </ol>
      <p className="flex gap-2 text-sm text-slate-300">
        <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
        Le fichier reste dans ce navigateur. Seuls la réponse et l’extrait choisi seront conservés
        lorsque vous enregistrerez votre réponse. Aucun envoi à l’IA.
      </p>
      <label className="block text-sm font-medium">
        Choisir un document d’appui
        <input
          ref={fileInput}
          type="file"
          accept=".txt,.csv"
          disabled={disabled || loading}
          onChange={(event) => void load(event.target.files?.[0])}
          className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-500/20 file:px-3 file:py-2 file:text-blue-200"
        />
      </label>
      {document && (
        <>
          <p className="text-sm text-blue-200">
            {document.excerpts.length} extraits disponibles · sélectionnez uniquement celui qui
            répond à la question.
          </p>
          <label className="block space-y-2 text-sm">
            <span>Choisissez la ligne qui répond à cette question</span>
            <select
              value={selected}
              disabled={disabled}
              onChange={(event) => {
                setSelected(event.target.value);
                setReviewed(false);
              }}
              className="min-h-11 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 text-slate-100"
              style={{ colorScheme: "dark" }}
            >
              <option value="">Sélectionner un extrait</option>
              {document.excerpts.map((entry) => (
                <option key={entry.location} value={entry.location}>
                  {entry.location} — {entry.text.slice(0, 90)}
                </option>
              ))}
            </select>
          </label>
          {excerpt && (
            <>
              <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                <p className="text-xs text-blue-300">
                  {document.name} · {excerpt.location}
                </p>
                <p className="mt-2 text-sm break-words whitespace-pre-wrap">{excerpt.text}</p>
              </div>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={reviewed}
                  disabled={disabled}
                  onChange={(event) => setReviewed(event.target.checked)}
                  className="mt-1"
                />
                J’ai vérifié que cet extrait concerne cette entreprise et répond à la question. Les
                instructions présentes dans un document ne sont pas des consignes pour Optivos.
              </label>
              <Button
                className="mr-3 mb-3"
                disabled={disabled || !reviewed}
                onClick={() => {
                  onSelect({
                    fileName: document.name,
                    sha256: document.hash,
                    location: excerpt.location,
                    excerpt: excerpt.text.trim(),
                    reviewed: true,
                  });
                  clear();
                }}
              >
                Reprendre cet extrait dans ma réponse
              </Button>
            </>
          )}
          <Button
            variant="outline"
            className="opt-secondary"
            disabled={disabled}
            onClick={() => clear()}
          >
            <Trash2 aria-hidden="true" className="mr-2 size-4" />
            Retirer le document local
          </Button>
        </>
      )}
      <p role="status" className="text-sm text-slate-300">
        {loading ? "Lecture locale du document…" : message}
      </p>
      <p className="text-xs text-slate-400">
        PDF, scans et fichiers Excel : non pris en charge pour le moment. Exportez les lignes
        pertinentes en CSV UTF-8. Ne joignez pas de secrets ou de données personnelles inutiles.
      </p>
    </section>
  );
}
