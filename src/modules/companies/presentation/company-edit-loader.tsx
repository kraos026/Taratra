"use client";

import { useEffect, useState } from "react";
import type { CompanyDetailResponse } from "./company-view";
import { CompanyForm } from "./company-form";
import { readApiResponse } from "@/shared/presentation/api-client";

export function CompanyEditLoader({ id }: { id: string }) {
  const [data, setData] = useState<CompanyDetailResponse>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    void fetch(`/api/companies/${id}`, { cache: "no-store" })
      .then(async (response) => {
        return readApiResponse<CompanyDetailResponse>(response, "Entreprise introuvable.");
      })
      .then(setData)
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
