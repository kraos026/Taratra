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
type Version = {
  id: string;
  versionNumber: number;
  status: "draft" | "published" | "archived";
  sections: Array<{
    id: string;
    title: string;
    position: number;
    questions: Array<{
      id: string;
      code: string;
      label: string;
      questionType: string;
      required: boolean;
      position: number;
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
  const payload = (await response.json()) as { data?: T; error?: { message: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? "Une erreur est survenue.");
  return payload.data as T;
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
  useEffect(() => {
    void json<Detail>(`/api/questionnaires/${templateId}`).then(setData);
  }, [templateId]);
  const version = data?.item.versions.find((v) => v.id === versionId);
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
      {version.sections.map((section) => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle>
              {section.position}. {section.title}
            </CardTitle>
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
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ))}
      {version.sections.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            Cette version ne contient aucune section. Utilisez l’API d’administration pour ajouter
            les premières sections.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
