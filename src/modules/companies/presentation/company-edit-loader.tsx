"use client";

import { useEffect, useState } from "react";
import type { CompanyDetailResponse } from "./company-view";
import { CompanyForm } from "./company-form";

export function CompanyEditLoader({ id }: { id: string }) {
  const [data, setData] = useState<CompanyDetailResponse>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    void fetch(`/api/companies/${id}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<{ data: CompanyDetailResponse }>;
      })
      .then((payload) => setData(payload.data))
      .catch(() => setError("Entreprise introuvable."));
  }, [id]);
  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-neutral-500">Chargement…</p>;
  if (!data.permissions.canWrite) {
    return (
      <p className="text-red-600">Vous n’avez pas la permission de modifier cette entreprise.</p>
    );
  }
  return <CompanyForm company={data.company} />;
}
