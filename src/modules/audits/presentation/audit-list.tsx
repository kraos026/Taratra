"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileSearch, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { readApiResponse } from "@/shared/presentation/api-client";

type AuditListItem = {
  id: string;
  status: string;
  progressPercentage: number;
  updatedAt: string;
  company: { id: string; name: string };
  questionnaireVersion: { template: { name: string } } | null;
};

export function AuditList() {
  const [items, setItems] = useState<AuditListItem[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    void fetch("/api/audits?page=1&pageSize=100&sortBy=updatedAt&sortOrder=desc", {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await readApiResponse<{ items: AuditListItem[] }>(
          response,
          "Impossible de charger vos audits.",
        );
        setItems(payload.items);
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Impossible de charger les audits."),
      );
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-violet-600">AutomateX</p>
          <h1 className="text-3xl font-bold">Audits</h1>
          <p className="text-sm text-neutral-500">Audits réels de votre organisation.</p>
        </div>
        <Link className={buttonVariants()} href="/audits/new">
          <Plus size={17} /> Nouvel audit
        </Link>
      </div>
      {error && (
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </p>
      )}
      {!items && !error && <p>Chargement…</p>}
      {items?.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <FileSearch className="mx-auto text-neutral-300" />
            <h2 className="mt-3 font-semibold">Aucun audit</h2>
            <p className="text-sm text-neutral-500">
              Créez un audit depuis une entreprise existante.
            </p>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-3">
        {items?.map((audit) => (
          <Link
            className="rounded-xl border bg-white p-5 transition hover:border-violet-300 hover:shadow-sm"
            href={`/audits/${audit.id}`}
            key={audit.id}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <strong>{audit.company.name}</strong>
                <p className="text-sm text-neutral-500">
                  {audit.questionnaireVersion?.template.name ?? "Questionnaire"}
                </p>
              </div>
              <div className="text-right">
                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs text-violet-700">
                  {audit.status.replaceAll("_", " ")}
                </span>
                <p className="mt-2 text-sm">{audit.progressPercentage}%</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <Link className="text-sm font-semibold text-violet-600" href="/">
        ← Retour au tableau de bord
      </Link>
    </div>
  );
}
