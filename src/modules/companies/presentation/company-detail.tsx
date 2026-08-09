"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Archive, ArrowLeft, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyStatusBadge } from "./company-status-badge";
import type { CompanyDetailResponse } from "./company-view";

async function fetchCompany(id: string): Promise<CompanyDetailResponse> {
  const response = await fetch(`/api/companies/${id}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Entreprise introuvable.");
  const payload = (await response.json()) as { data: CompanyDetailResponse };
  return payload.data;
}

export function CompanyDetail({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<CompanyDetailResponse>();
  const [error, setError] = useState<string>();

  const load = useCallback(() => {
    void fetchCompany(id)
      .then((company) => {
        setData(company);
        setError(undefined);
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Une erreur est survenue."),
      );
  }, [id]);

  useEffect(load, [load]);

  async function action(name: "archive" | "restore" | "delete") {
    const company = data?.company;
    if (!company || !window.confirm(`Confirmer l’action sur ${company.name} ?`)) return;
    const response = await fetch(
      name === "delete" ? `/api/companies/${id}` : `/api/companies/${id}/${name}`,
      { method: name === "delete" ? "DELETE" : "POST" },
    );
    if (!response.ok) {
      setError("Cette action n’a pas pu être réalisée.");
      return;
    }
    if (name === "delete") router.push("/companies");
    else load();
  }

  if (error)
    return (
      <Card>
        <CardContent className="py-12 text-center text-red-600">{error}</CardContent>
      </Card>
    );
  if (!data)
    return (
      <Card>
        <CardContent className="py-12 text-center text-neutral-500">Chargement…</CardContent>
      </Card>
    );

  const { company, permissions } = data;
  const facts = [
    ["Secteur", company.sectorId],
    ["Taille", company.companySize],
    ["Employés", company.employeeCount],
    ["Contact", company.primaryContactName],
    ["Fonction", company.primaryContactRole],
    ["Téléphone", company.phone],
    ["E-mail", company.email],
    ["Site web", company.website],
    ["Adresse", company.address],
    ["Ville", company.city],
    ["Pays", company.country],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            className="mb-3 flex items-center gap-2 text-sm text-neutral-500 hover:text-violet-600"
            href="/companies"
          >
            <ArrowLeft size={15} /> Retour aux entreprises
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{company.name}</h1>
            <CompanyStatusBadge status={company.status} archived={Boolean(company.deletedAt)} />
          </div>
        </div>
        <div className="flex gap-2">
          {!company.deletedAt && (
            <Button onClick={() => router.push(`/companies/${id}/automation-audit`)}>
              Automation Audit
            </Button>
          )}
          {permissions.canWrite && !company.deletedAt && (
            <Button variant="outline" onClick={() => router.push(`/companies/${id}/discovery`)}>
              Discovery
            </Button>
          )}
          {permissions.canWrite && !company.deletedAt && (
            <Button variant="outline" onClick={() => router.push(`/companies/${id}/interview`)}>
              Entretien
            </Button>
          )}
          {!company.deletedAt && (
            <Button variant="outline" onClick={() => router.push(`/companies/${id}/process-maps`)}>
              Process Maps
            </Button>
          )}
          {permissions.canWrite && !company.deletedAt && (
            <Button variant="outline" onClick={() => router.push(`/companies/${id}/audits/new`)}>
              Nouvel audit
            </Button>
          )}
          {permissions.canWrite && !company.deletedAt && (
            <Button variant="outline" onClick={() => router.push(`/companies/${id}/edit`)}>
              <Pencil size={16} /> Modifier
            </Button>
          )}
          {permissions.canWrite && (
            <Button
              variant="outline"
              onClick={() => void action(company.deletedAt ? "restore" : "archive")}
            >
              {company.deletedAt ? <RotateCcw size={16} /> : <Archive size={16} />}{" "}
              {company.deletedAt ? "Restaurer" : "Archiver"}
            </Button>
          )}
          {permissions.canDelete && (
            <Button
              variant="outline"
              className="text-red-600"
              onClick={() => void action("delete")}
            >
              <Trash2 size={16} /> Supprimer
            </Button>
          )}
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={String(label)}>
              <p className="text-xs font-semibold text-neutral-400 uppercase">{label}</p>
              <p className="mt-1 text-sm text-neutral-800">{value ?? "—"}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap text-neutral-700">
            {company.description ?? "Aucune description."}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Notes internes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap text-neutral-700">
            {company.internalNotes ?? "Aucune note interne."}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
