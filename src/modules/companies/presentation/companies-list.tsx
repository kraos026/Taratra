"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Archive, ArrowUpDown, Building2, Pencil, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CompanyPage, CompanyPermissions, CompanyStatus } from "../domain/company";
import { CompanyStatusBadge } from "./company-status-badge";
import type { CompanyView } from "./company-view";
import { readApiResponse } from "@/shared/presentation/api-client";

type ViewPage = Omit<CompanyPage, "items"> & {
  items: readonly CompanyView[];
  permissions: CompanyPermissions;
};

async function fetchCompanies(queryString: string): Promise<ViewPage> {
  const response = await fetch(`/api/companies?${queryString}`, { cache: "no-store" });
  return readApiResponse<ViewPage>(response, "Impossible de charger vos entreprises.");
}

export function CompaniesList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [result, setResult] = useState<ViewPage>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    void fetchCompanies(queryString)
      .then((page) => {
        setResult(page);
        setError(undefined);
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Une erreur est survenue."),
      )
      .finally(() => setLoading(false));
  }, [queryString]);

  useEffect(load, [load]);

  function updateQuery(values: Record<string, string>) {
    const next = new URLSearchParams(searchParams);
    Object.entries(values).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    if (!values.page) next.set("page", "1");
    router.push(`/companies?${next.toString()}`);
  }

  async function toggleArchive(company: CompanyView) {
    const verb = company.deletedAt ? "restaurer" : "archiver";
    if (!window.confirm(`Voulez-vous ${verb} ${company.name} ?`)) return;
    const action = company.deletedAt ? "restore" : "archive";
    const response = await fetch(`/api/companies/${company.id}/${action}`, { method: "POST" });
    if (!response.ok) setError(`Impossible de ${verb} cette entreprise.`);
    else load();
  }

  const currentPage = result?.page ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold text-violet-600">CRM</p>
          <h1 className="text-3xl font-bold text-neutral-950">Entreprises</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Gérez vos clients et prospects en toute sécurité.
          </p>
        </div>
        {result?.permissions.canWrite && (
          <Button onClick={() => router.push("/companies/new")}>
            <Plus size={17} /> Ajouter une entreprise
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-4">
          <Input
            aria-label="Rechercher"
            placeholder="Nom, contact, email, ville…"
            defaultValue={searchParams.get("search") ?? ""}
            onKeyDown={(event) => {
              if (event.key === "Enter") updateQuery({ search: event.currentTarget.value });
            }}
          />
          <select
            aria-label="Filtrer par statut"
            className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm"
            value={searchParams.get("status") ?? ""}
            onChange={(event) => updateQuery({ status: event.target.value })}
          >
            <option value="">Tous les statuts</option>
            {[
              "prospect",
              "contacted",
              "audit_scheduled",
              "audit_in_progress",
              "client",
              "archived",
            ].map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrer par taille"
            className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm"
            value={searchParams.get("companySize") ?? ""}
            onChange={(event) => updateQuery({ companySize: event.target.value })}
          >
            <option value="">Toutes les tailles</option>
            {["micro", "small", "medium", "large", "enterprise"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          {result?.permissions.canWrite && (
            <label className="flex items-center gap-2 text-sm text-neutral-600">
              <input
                type="checkbox"
                checked={searchParams.get("includeArchived") === "true"}
                onChange={(event) => updateQuery({ includeArchived: String(event.target.checked) })}
              />
              Inclure les archives
            </label>
          )}
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="py-14 text-center text-neutral-500">
            Chargement des entreprises…
          </CardContent>
        </Card>
      )}
      {error && (
        <Card>
          <CardContent className="py-10 text-center text-red-600" role="alert">
            {error}
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setLoading(true);
                  load();
                }}
              >
                Réessayer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {!loading && !error && result?.items.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="mx-auto text-neutral-300" size={42} />
            <h2 className="mt-4 font-semibold">Aucune entreprise</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Ajoutez votre premier client ou modifiez les filtres.
            </p>
          </CardContent>
        </Card>
      )}
      {!loading && !error && result && result.items.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="px-5 py-3">
                    <button
                      className="flex items-center gap-1 font-semibold"
                      onClick={() =>
                        updateQuery({
                          sortBy: "name",
                          sortOrder: searchParams.get("sortOrder") === "asc" ? "desc" : "asc",
                        })
                      }
                    >
                      Entreprise <ArrowUpDown size={14} />
                    </button>
                  </th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Secteur</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3">Ville</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((company) => (
                  <tr className="border-b last:border-0" key={company.id}>
                    <td className="px-5 py-4">
                      <Link
                        className="font-semibold text-neutral-900 hover:text-violet-600"
                        href={`/companies/${company.id}`}
                      >
                        {company.name}
                      </Link>
                      <p className="text-xs text-neutral-400">
                        {company.companySize ?? "Taille non renseignée"}
                      </p>
                    </td>
                    <td className="px-5 py-4">{company.primaryContactName ?? "—"}</td>
                    <td className="px-5 py-4">{company.sectorId ?? "—"}</td>
                    <td className="px-5 py-4">
                      <CompanyStatusBadge
                        status={company.status as CompanyStatus}
                        archived={Boolean(company.deletedAt)}
                      />
                    </td>
                    <td className="px-5 py-4">{company.city ?? "—"}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        {result.permissions.canWrite && !company.deletedAt && (
                          <Link
                            aria-label={`Modifier ${company.name}`}
                            className="rounded p-2 hover:bg-neutral-100"
                            href={`/companies/${company.id}/edit`}
                          >
                            <Pencil size={16} />
                          </Link>
                        )}
                        {result.permissions.canWrite && (
                          <button
                            aria-label={
                              company.deletedAt
                                ? `Restaurer ${company.name}`
                                : `Archiver ${company.name}`
                            }
                            className="rounded p-2 hover:bg-neutral-100"
                            onClick={() => void toggleArchive(company)}
                          >
                            {company.deletedAt ? <RotateCcw size={16} /> : <Archive size={16} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t px-5 py-4 text-sm">
            <span>
              {result.total} entreprise{result.total > 1 ? "s" : ""}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage <= 1}
                onClick={() => updateQuery({ page: String(currentPage - 1) })}
              >
                Précédent
              </Button>
              <span className="px-2 py-2">
                {currentPage} / {result.totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage >= result.totalPages}
                onClick={() => updateQuery({ page: String(currentPage + 1) })}
              >
                Suivant
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
