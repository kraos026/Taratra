"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
type Question = {
  id: string;
  label: string;
  description: string | null;
  questionType: string;
  required: boolean;
  optionsJson: unknown;
  position: number;
};
type Section = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  questions: Question[];
};
type Audit = {
  id: string;
  status: string;
  progressPercentage: number;
  company: { id: string; name: string };
  answers: Array<{ questionId: string; valueJson: unknown }>;
  questionnaireVersion: { template: { name: string }; sections: Section[] };
};
type Detail = { item: Audit; permissions: { canWrite: boolean; canValidate: boolean } };
async function json<T>(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const p = (await r.json()) as { data?: T; error?: { message: string } };
  if (!r.ok) throw new Error(p.error?.message ?? "Erreur");
  return p.data as T;
}
export function NewAudit({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [templates, setTemplates] = useState<
    Array<{
      id: string;
      name: string;
      versions: Array<{ id: string; status: string; versionNumber: number }>;
    }>
  >([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    void json<{ items: typeof templates }>("/api/questionnaires?status=published&pageSize=100")
      .then((v) => setTemplates(v.items))
      .catch((e: Error) => setError(e.message));
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      const values = Object.fromEntries(new FormData(e.currentTarget));
      const audit = await json<{ id: string }>("/api/audits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyId, questionnaireVersionId: values.questionnaireVersionId }),
      });
      router.push(`/audits/${audit.id}/questionnaire`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setPending(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lancer un audit</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <Label htmlFor="questionnaireVersionId">Questionnaire publié</Label>
            <select
              className="mt-2 h-10 w-full rounded-md border bg-white px-3"
              id="questionnaireVersionId"
              name="questionnaireVersionId"
              required
            >
              <option value="">Sélectionner…</option>
              {templates.flatMap((t) =>
                t.versions
                  .filter((v) => v.status === "published")
                  .map((v) => (
                    <option value={v.id} key={v.id}>
                      {t.name} — version {v.versionNumber}
                    </option>
                  )),
              )}
            </select>
          </div>
          {error && (
            <p role="alert" className="text-red-600">
              {error}
            </p>
          )}
          <Button disabled={pending}>{pending ? "Création…" : "Commencer l’audit"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
export function AuditOverview({ id, summary = false }: { id: string; summary?: boolean }) {
  const [data, setData] = useState<Detail>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    void json<Detail>(`/api/audits/${id}`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [id]);
  async function action(name: "complete" | "validate" | "archive") {
    if (!window.confirm(`Confirmer l’action ${name} ?`)) return;
    try {
      await json(`/api/audits/${id}/${name}`, { method: "POST" });
      setData(await json<Detail>(`/api/audits/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }
  if (error)
    return (
      <p role="alert" className="text-red-600">
        {error}
      </p>
    );
  if (!data) return <p>Chargement…</p>;
  const { item, permissions } = data;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-sm text-violet-600">{item.company.name}</p>
          <h1 className="text-3xl font-bold">
            {summary ? "Résumé de l’audit" : item.questionnaireVersion.template.name}
          </h1>
          <Badge>{item.status}</Badge>
        </div>
        <div className="flex gap-2">
          {permissions.canWrite && (
            <Button onClick={() => void action("complete")}>Terminer</Button>
          )}
          {permissions.canValidate && (
            <Button onClick={() => void action("validate")}>Valider définitivement</Button>
          )}
        </div>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-neutral-200">
        <div className="h-full bg-violet-600" style={{ width: `${item.progressPercentage}%` }} />
      </div>
      <p>{item.progressPercentage}% complété</p>
      {summary ? (
        <Summary audit={item} />
      ) : (
        <div className="flex gap-3">
          <Button onClick={() => location.assign(`/audits/${id}/questionnaire`)}>
            Ouvrir le questionnaire
          </Button>
          <Button variant="outline" onClick={() => location.assign(`/audits/${id}/summary`)}>
            Voir le résumé
          </Button>
        </div>
      )}
    </div>
  );
}
function Summary({ audit }: { audit: Audit }) {
  const answers = new Map(audit.answers.map((a) => [a.questionId, a.valueJson]));
  return (
    <div className="space-y-4">
      {audit.questionnaireVersion.sections.map((s) => (
        <Card key={s.id}>
          <CardHeader>
            <CardTitle>{s.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {s.questions.map((q) => (
              <div key={q.id}>
                <p className="font-medium">{q.label}</p>
                <p className="text-sm text-neutral-600">
                  {JSON.stringify(answers.get(q.id) ?? "Non renseigné")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
export function AuditQuestionnaire({ id }: { id: string }) {
  const [data, setData] = useState<Detail>();
  const [sectionIndex, setSectionIndex] = useState(0);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  useEffect(() => {
    void json<Detail>(`/api/audits/${id}`).then(setData);
  }, [id]);
  useEffect(() => {
    const listener = (e: BeforeUnloadEvent) => {
      if (state === "saving") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [state]);
  if (!data) return <p>Chargement…</p>;
  const section = data.item.questionnaireVersion.sections[sectionIndex];
  const answers = new Map(data.item.answers.map((a) => [a.questionId, a.valueJson]));
  async function save(questionId: string, value: unknown) {
    setState("saving");
    try {
      await json(`/api/audits/${id}/answers/${questionId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value }),
      });
      setState("saved");
      setData(await json<Detail>(`/api/audits/${id}`));
    } catch {
      setState("error");
    }
  }
  if (!section) return <p>Ce questionnaire ne contient aucune section.</p>;
  return (
    <div className="space-y-6">
      <div>
        <Link href={`/audits/${id}`}>← Quitter</Link>
        <div className="mt-3 flex justify-between">
          <h1 className="text-2xl font-bold">
            {section.position}. {section.title}
          </h1>
          <span role="status">
            {state === "saving"
              ? "Sauvegarde…"
              : state === "saved"
                ? "Enregistré"
                : state === "error"
                  ? "Erreur de sauvegarde"
                  : ""}
          </span>
        </div>
      </div>
      <Card>
        <CardContent className="space-y-7 py-6">
          {section.questions.map((q) => (
            <QuestionField
              key={q.id}
              question={q}
              initial={answers.get(q.id)}
              disabled={!data.permissions.canWrite}
              save={(v) => void save(q.id, v)}
            />
          ))}
        </CardContent>
      </Card>
      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={sectionIndex === 0}
          onClick={() => setSectionIndex((i) => i - 1)}
        >
          Précédent
        </Button>
        <span>
          {sectionIndex + 1} / {data.item.questionnaireVersion.sections.length}
        </span>
        {sectionIndex < data.item.questionnaireVersion.sections.length - 1 ? (
          <Button onClick={() => setSectionIndex((i) => i + 1)}>Suivant</Button>
        ) : (
          <Button onClick={() => location.assign(`/audits/${id}/summary`)}>Résumé</Button>
        )}
      </div>
    </div>
  );
}
function QuestionField({
  question,
  initial,
  disabled,
  save,
}: {
  question: Question;
  initial: unknown;
  disabled: boolean;
  save: (v: unknown) => void;
}) {
  const common = { disabled, "aria-required": question.required };
  const options = Array.isArray(question.optionsJson) ? question.optionsJson.map(String) : [];
  return (
    <div>
      <Label htmlFor={question.id}>
        {question.label}
        {question.required ? " *" : ""}
      </Label>
      {question.description && <p className="text-sm text-neutral-500">{question.description}</p>}
      {question.questionType === "long_text" ? (
        <Textarea
          id={question.id}
          defaultValue={typeof initial === "string" ? initial : ""}
          onBlur={(e) => save(e.target.value)}
          {...common}
        />
      ) : question.questionType === "boolean" ? (
        <select
          id={question.id}
          defaultValue={String(initial ?? "")}
          onChange={(e) => save(e.target.value === "true")}
          {...common}
        >
          <option value="">Sélectionner…</option>
          <option value="true">Oui</option>
          <option value="false">Non</option>
        </select>
      ) : ["single_choice", "multiple_choice"].includes(question.questionType) ? (
        <select
          id={question.id}
          multiple={question.questionType === "multiple_choice"}
          defaultValue={
            question.questionType === "multiple_choice" && Array.isArray(initial)
              ? initial.map(String)
              : String(initial ?? "")
          }
          onChange={(e) =>
            save(
              question.questionType === "multiple_choice"
                ? Array.from(e.target.selectedOptions, (o) => o.value)
                : e.target.value,
            )
          }
          {...common}
        >
          {question.questionType !== "multiple_choice" && <option value="">Sélectionner…</option>}
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : (
        <Input
          id={question.id}
          type={
            ["number", "percentage", "currency"].includes(question.questionType)
              ? "number"
              : question.questionType === "date"
                ? "date"
                : "text"
          }
          defaultValue={typeof initial === "string" || typeof initial === "number" ? initial : ""}
          onBlur={(e) =>
            save(
              ["number", "percentage", "currency"].includes(question.questionType)
                ? Number(e.target.value)
                : e.target.value,
            )
          }
          {...common}
        />
      )}
    </div>
  );
}
