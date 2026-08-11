"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { readApiResponse } from "@/shared/presentation/api-client";
type Version = {
  id: string;
  versionNumber: number;
  status: "draft" | "published" | "archived";
  sections: Array<{
    id: string;
    title: string;
    description: string | null;
    position: number;
    questions: Array<{
      id: string;
      code: string;
      label: string;
      description: string | null;
      questionType: string;
      required: boolean;
      position: number;
      optionsJson: unknown[] | null;
      validationJson: Record<string, unknown>;
      metadataJson: Record<string, unknown>;
    }>;
  }>;
};
type Template = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  isSystem: boolean;
  versions: Version[];
};
type Detail = { item: Template; permissions: { canManage: boolean; canUse: boolean } };
async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  return readApiResponse<T>(response, "Une erreur est survenue.");
}
export function QuestionnaireList() {
  const [data, setData] = useState<{ items: Template[]; permissions: { canManage: boolean } }>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    void json<typeof data>("/api/questionnaires")
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);
  if (error)
    return (
      <p role="alert" className="text-red-600">
        {error}
      </p>
    );
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div>
          <p className="text-sm font-semibold text-violet-600">Configuration</p>
          <h1 className="text-3xl font-bold">Questionnaires</h1>
        </div>
        {data?.permissions.canManage && (
          <Link className={buttonVariants()} href="/questionnaires/new">
            Nouveau questionnaire
          </Link>
        )}
      </div>
      <div className="grid gap-4">
        {data?.items.map((t) => (
          <Card key={t.id}>
            <CardContent className="flex items-center justify-between py-5">
              <div>
                <Link
                  className="font-semibold hover:text-violet-600"
                  href={`/questionnaires/${t.id}`}
                >
                  {t.name}
                </Link>
                <p className="text-sm text-neutral-500">{t.category}</p>
              </div>
              <div className="flex gap-2">
                <Badge>{t.isSystem ? "Système" : "Personnalisé"}</Badge>
                {t.versions[0] && <Badge>{t.versions[0].status}</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {data?.items.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">Aucun questionnaire disponible.</CardContent>
        </Card>
      )}
    </div>
  );
}
export function QuestionnaireForm({ id }: { id?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const saved = await json<{ id: string }>(
        id ? `/api/questionnaires/${id}` : "/api/questionnaires",
        {
          method: id ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      router.push(`/questionnaires/${saved.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur");
      setPending(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{id ? "Modifier le questionnaire" : "Nouveau questionnaire"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nom</Label>
            <Input id="name" name="name" required minLength={2} />
          </div>
          <div>
            <Label htmlFor="category">Catégorie</Label>
            <Input id="category" name="category" required />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" />
          </div>
          {message && (
            <p role="alert" className="text-red-600">
              {message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Annuler
            </Button>
            <Button disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
export function QuestionnaireDetail({ id }: { id: string }) {
  const [data, setData] = useState<Detail>();
  const [error, setError] = useState<string>();
  const load = () =>
    void json<Detail>(`/api/questionnaires/${id}`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  useEffect(load, [id]);
  async function action(path: string, confirmText: string) {
    if (!window.confirm(confirmText)) return;
    try {
      await json(path, { method: "POST" });
      load();
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
          <h1 className="text-3xl font-bold">{item.name}</h1>
          <p className="text-neutral-500">{item.description}</p>
        </div>
        {permissions.canManage && (
          <div className="flex gap-2">
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={`/questionnaires/${id}/edit`}
            >
              Modifier
            </Link>
            <Button
              onClick={() =>
                void action(
                  `/api/questionnaires/${id}/versions`,
                  "Créer une nouvelle version vide ?",
                )
              }
            >
              Nouvelle version
            </Button>
          </div>
        )}
      </div>
      {item.versions.map((v) => (
        <Card key={v.id}>
          <CardHeader>
            <CardTitle className="flex justify-between">
              <Link href={`/questionnaires/${id}/versions/${v.id}`}>Version {v.versionNumber}</Link>
              <Badge>{v.status}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <span className="text-sm text-neutral-500">{v.sections.length} sections</span>
            {permissions.canManage && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void action(
                      `/api/questionnaire-versions/${v.id}/duplicate`,
                      "Dupliquer cette version ?",
                    )
                  }
                >
                  Dupliquer
                </Button>
                {v.status === "draft" && (
                  <Button
                    size="sm"
                    onClick={() =>
                      void action(
                        `/api/questionnaire-versions/${v.id}/publish`,
                        "Publier définitivement cette version ?",
                      )
                    }
                  >
                    Publier
                  </Button>
                )}
                {v.status === "published" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void action(
                        `/api/questionnaire-versions/${v.id}/archive`,
                        "Archiver cette version ?",
                      )
                    }
                  >
                    Archiver
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
export function VersionEditor({
  templateId,
  versionId,
}: {
  templateId: string;
  versionId: string;
}) {
  const [data, setData] = useState<Detail>();
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const load = () =>
    void json<Detail>(`/api/questionnaires/${templateId}`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  useEffect(() => {
    void json<Detail>(`/api/questionnaires/${templateId}`)
      .then(setData)
      .catch((caught: Error) => setError(caught.message));
  }, [templateId]);
  const version = data?.item.versions.find((v) => v.id === versionId);
  async function mutate(url: string, init: RequestInit, success: string) {
    setPending(true);
    setError(undefined);
    try {
      await json(url, {
        ...init,
        headers: { "content-type": "application/json", ...init.headers },
      });
      setMessage(success);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erreur");
    } finally {
      setPending(false);
    }
  }
  function move(kind: "sections" | "questions", id: string, position: number) {
    void mutate(
      `/api/questionnaire-${kind}/${id}`,
      { method: "PATCH", body: JSON.stringify({ operation: "move", position }) },
      "Ordre mis à jour.",
    );
  }
  function remove(kind: "sections" | "questions", id: string, label: string) {
    if (!window.confirm(`Supprimer ${label} ? Cette action est définitive.`)) return;
    void mutate(`/api/questionnaire-${kind}/${id}`, { method: "DELETE" }, `${label} supprimée.`);
  }
  function editSection(section: Version["sections"][number]) {
    const title = window.prompt("Titre de la section", section.title)?.trim();
    if (!title) return;
    void mutate(
      `/api/questionnaire-sections/${section.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          title,
          description: section.description ?? undefined,
          position: section.position,
        }),
      },
      "Section modifiée.",
    );
  }
  function editQuestion(question: Version["sections"][number]["questions"][number]) {
    const label = window.prompt("Libellé de la question", question.label)?.trim();
    if (!label) return;
    void mutate(
      `/api/questionnaire-questions/${question.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          ...question,
          label,
          description: question.description ?? undefined,
          optionsJson: question.optionsJson ?? undefined,
        }),
      },
      "Question modifiée.",
    );
  }
  async function addSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await json(`/api/questionnaire-versions/${versionId}/sections`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, position: Number(values.position) }),
      });
      event.currentTarget.reset();
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erreur");
    }
  }
  async function addQuestion(event: FormEvent<HTMLFormElement>, sectionId: string) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const choice = ["single_choice", "multiple_choice"].includes(String(values.questionType));
    try {
      await json(`/api/questionnaire-sections/${sectionId}/questions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: values.code,
          label: values.label,
          questionType: values.questionType,
          required: values.required === "on",
          position: Number(values.position),
          optionsJson: choice
            ? String(values.options)
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean)
            : undefined,
          validationJson: {},
          metadataJson: {},
        }),
      });
      event.currentTarget.reset();
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erreur");
    }
  }
  if (!version) return <p>Chargement…</p>;
  return (
    <div className="space-y-5">
      <div>
        <Link className="text-sm text-violet-600" href={`/questionnaires/${templateId}`}>
          ← Retour
        </Link>
        <h1 className="text-3xl font-bold">Version {version.versionNumber}</h1>
        <Badge>{version.status}</Badge>
      </div>
      {error && (
        <p className="text-red-600" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="text-sm text-emerald-700" role="status">
          {message}
        </p>
      )}
      {version.sections.map((section) => (
        <Card key={section.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>
                {section.position}. {section.title}
              </CardTitle>
              {version.status === "draft" && data?.permissions.canManage && (
                <div className="flex flex-wrap gap-2" aria-label={`Actions pour ${section.title}`}>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending || section.position === 1}
                    aria-label={`Monter ${section.title}`}
                    onClick={() => move("sections", section.id, section.position - 1)}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending || section.position === version.sections.length}
                    aria-label={`Descendre ${section.title}`}
                    onClick={() => move("sections", section.id, section.position + 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => editSection(section)}
                  >
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => remove("sections", section.id, "la section")}
                  >
                    Supprimer
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {section.questions.map((q) => (
                <li key={q.id} className="rounded border p-3">
                  <span className="font-medium">
                    {q.position}. {q.label}
                  </span>
                  <span className="ml-2 text-xs text-neutral-500">
                    {q.questionType}
                    {q.required ? " · obligatoire" : ""}
                  </span>
                  {version.status === "draft" && data?.permissions.canManage && (
                    <div
                      className="mt-3 flex flex-wrap gap-2"
                      aria-label={`Actions pour ${q.label}`}
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending || q.position === 1}
                        aria-label={`Monter ${q.label}`}
                        onClick={() => move("questions", q.id, q.position - 1)}
                      >
                        ↑
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending || q.position === section.questions.length}
                        aria-label={`Descendre ${q.label}`}
                        onClick={() => move("questions", q.id, q.position + 1)}
                      >
                        ↓
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => editQuestion(q)}
                      >
                        Modifier
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => remove("questions", q.id, "la question")}
                      >
                        Supprimer
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ol>
            {version.status === "draft" && data?.permissions.canManage && (
              <form
                className="mt-5 grid gap-3 border-t pt-5 md:grid-cols-5"
                onSubmit={(e) => void addQuestion(e, section.id)}
              >
                <Input name="code" placeholder="Code unique" required />
                <Input name="label" placeholder="Libellé" required />
                <select
                  name="questionType"
                  className="h-10 rounded-md border bg-white px-3"
                  required
                >
                  <option value="short_text">Texte court</option>
                  <option value="long_text">Texte long</option>
                  <option value="number">Nombre</option>
                  <option value="boolean">Booléen</option>
                  <option value="single_choice">Choix unique</option>
                  <option value="multiple_choice">Choix multiples</option>
                  <option value="percentage">Pourcentage</option>
                  <option value="currency">Devise</option>
                  <option value="date">Date</option>
                </select>
                <Input name="options" placeholder="Options séparées par virgules" />
                <div className="flex gap-2">
                  <Input
                    name="position"
                    type="number"
                    min={1}
                    defaultValue={section.questions.length + 1}
                    required
                  />
                  <Button size="sm">Ajouter</Button>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input name="required" type="checkbox" /> Obligatoire
                </label>
              </form>
            )}
          </CardContent>
        </Card>
      ))}
      {version.status === "draft" && data?.permissions.canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Ajouter une section</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-[1fr_8rem_auto]" onSubmit={addSection}>
              <Input name="title" placeholder="Titre de la section" required />
              <Input
                name="position"
                type="number"
                min={1}
                defaultValue={version.sections.length + 1}
                required
              />
              <Button>Ajouter</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
