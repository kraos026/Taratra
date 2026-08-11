"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { readApiResponse } from "@/shared/presentation/api-client";

type Company = { id: string; name: string; sectorId: string | null };

export function NewAuditCompanyPicker() {
  const [companies, setCompanies] = useState<Company[]>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    void fetch("/api/companies?page=1&pageSize=100&sortBy=name&sortOrder=asc", {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await readApiResponse<{ items: Company[] }>(
          response,
          "Impossible de charger vos entreprises.",
        );
        setCompanies(payload.items);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Erreur"));
  }, []);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm font-semibold text-violet-600">Nouvel audit</p>
        <h1 className="text-3xl font-bold">Choisissez une entreprise</h1>
        <p className="text-sm text-neutral-500">
          L’audit utilisera les permissions et données de votre organisation.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      {!companies && !error && <p>Chargement…</p>}
      {companies?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="mx-auto text-neutral-300" />
            <p className="mt-3">Créez d’abord une entreprise.</p>
            <Link className="mt-3 inline-block font-semibold text-violet-600" href="/companies/new">
              Ajouter une entreprise
            </Link>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-3">
        {companies?.map((company) => (
          <Link
            className="rounded-xl border bg-white p-5 hover:border-violet-300"
            href={`/companies/${company.id}/audits/new`}
            key={company.id}
          >
            <strong>{company.name}</strong>
            <p className="text-sm text-neutral-500">
              {company.sectorId ?? "Secteur non renseigné"}
            </p>
          </Link>
        ))}
      </div>
      <Link className="text-sm font-semibold text-violet-600" href="/audits">
        ← Retour aux audits
      </Link>
    </div>
  );
}
