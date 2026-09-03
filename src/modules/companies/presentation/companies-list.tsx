"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Building2,
  CircleGauge,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CompanyPage, CompanyPermissions } from "../domain/company";
import type { CompanyView } from "./company-view";

type ViewPage = Omit<CompanyPage, "items"> & {
  items: readonly CompanyView[];
  permissions: CompanyPermissions;
};

async function fetchCompanies(queryString: string): Promise<ViewPage> {
  const suffix = queryString ? `?${queryString}` : "";
  const response = await fetch(`/api/companies${suffix}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Impossible de charger votre entreprise.");
  const payload = (await response.json()) as { data: ViewPage };
  return payload.data;
}

function safePilotQuery(searchParams: URLSearchParams): string {
  const next = new URLSearchParams();
  const search = searchParams.get("search")?.trim();
  if (search && !search.includes("@")) next.set("search", search);
  next.set("page", "1");
  next.set("pageSize", "12");
  next.set("sortBy", "updatedAt");
  next.set("sortOrder", "desc");
  return next.toString();
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function brandText(value: string): string {
  return value.replaceAll("AutomateX", "Optivos").replaceAll("AUTOMATEX", "OPTIVOS");
}

function sizeLabel(value: string | null): string {
  const labels: Record<string, string> = {
    micro: "Microentreprise",
    small: "Petite entreprise",
    medium: "Moyenne entreprise",
    large: "Grande entreprise",
    enterprise: "Grande organisation",
  };
  return value ? (labels[value] ?? value) : "Taille à préciser";
}

function statusLabel(value: string): string {
  const labels: Record<string, string> = {
    prospect: "Dossier à compléter",
    contacted: "Dossier en préparation",
    audit_scheduled: "Audit planifié",
    audit_in_progress: "Audit en cours",
    client: "Entreprise active",
    archived: "Archivée",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

export function CompaniesList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = useMemo(() => safePilotQuery(searchParams), [searchParams]);
  const [result, setResult] = useState<ViewPage>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  const retry = useCallback(() => {
    setLoading(true);
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

  useEffect(() => {
    let active = true;
    void fetchCompanies(queryString)
      .then((page) => {
        if (!active) return;
        setResult(page);
        setError(undefined);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Une erreur est survenue.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [queryString]);

  const primaryCompany = result?.items[0];
  const hasHiddenFilters =
    searchParams.has("companySize") ||
    searchParams.has("status") ||
    searchParams.has("includeArchived") ||
    Boolean(searchParams.get("search")?.includes("@"));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/70 p-6 shadow-2xl shadow-blue-950/20 sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold tracking-[0.28em] text-blue-300 uppercase">
              <Sparkles size={15} /> Espace Optivos
            </p>
            <h1 className="mt-3 font-['Manrope'] text-3xl font-extrabold tracking-tight sm:text-5xl">
              Mon entreprise
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
              Un point d’entrée simple pour lancer l’audit, suivre l’avancement et consulter les
              décisions publiées. L’interface reste centrée sur les preuves disponibles.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {primaryCompany ? (
              <Link
                href={`/companies/${primaryCompany.id}/automation-audit`}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-400"
              >
                Continuer l’audit <ArrowRight size={17} />
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      {hasHiddenFilters && (
        <section className="rounded-3xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p className="font-semibold">Filtres non applicables ignorés.</p>
          <p className="mt-1 text-amber-100/80">
            La navigation normale vers Mon entreprise affiche les dossiers de votre organisation
            sans recherche restrictive ni e-mail injecté.
          </p>
          <button
            type="button"
            className="mt-3 rounded-xl border border-amber-200/30 px-3 py-2 text-xs font-bold"
            onClick={() => router.replace("/companies")}
          >
            Réinitialiser l’adresse
          </button>
        </section>
      )}

      {loading && (
        <PilotState title="Chargement…" text="Nous récupérons votre espace entreprise." />
      )}

      {error && (
        <PilotState
          tone="error"
          title="Votre espace entreprise n’a pas pu être chargé"
          text={error}
          action={
            <Button variant="outline" onClick={retry}>
              Réessayer
            </Button>
          }
        />
      )}

      {!loading && !error && result?.items.length === 0 && (
        <PilotState
          title="Préparons votre première décision"
          text="Renseignez le contexte essentiel de votre entreprise. Optivos vous guidera ensuite, étape par étape, jusqu’aux recommandations et au plan d’action."
          action={
            result.permissions.canWrite ? (
              <Button onClick={() => router.push("/companies/new")}>
                <Plus size={17} /> Créer mon entreprise
              </Button>
            ) : null
          }
        />
      )}

      {!loading && !error && result && result.items.length > 0 && (
        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            {result.items.map((company) => {
              const companyName = brandText(company.name);
              return (
                <article
                  key={company.id}
                  className="rounded-[1.75rem] border border-white/10 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20"
                >
                  <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-blue-500/15 font-['Manrope'] text-lg font-extrabold text-blue-200 ring-1 ring-blue-400/25">
                        {initials(companyName)}
                      </div>
                      <div>
                        <p className="text-xs font-bold tracking-[0.2em] text-slate-500 uppercase">
                          Entreprise active
                        </p>
                        <h2 className="mt-1 text-2xl font-bold text-white">{companyName}</h2>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                            {company.sectorId ?? "Secteur à préciser"}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                            {sizeLabel(company.companySize)}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                            <MapPin size={13} />{" "}
                            {company.city ?? company.country ?? "Localisation à préciser"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Link
                        href={`/companies/${company.id}/automation-audit`}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-400"
                      >
                        Ouvrir l’audit <ArrowRight size={16} />
                      </Link>
                      <Link
                        href={`/companies/${company.id}`}
                        className="inline-flex items-center justify-center rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-100 transition hover:bg-white/5"
                      >
                        Détails
                      </Link>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <PilotMetric
                      icon={<ShieldCheck size={18} />}
                      label="Statut"
                      value={statusLabel(company.status)}
                    />
                    <PilotMetric
                      icon={<CircleGauge size={18} />}
                      label="Audit"
                      value="Prêt à poursuivre"
                    />
                    <PilotMetric
                      icon={<Building2 size={18} />}
                      label="Données"
                      value="Preuves publiées"
                    />
                  </div>
                </article>
              );
            })}
          </div>
          <aside className="rounded-[1.75rem] border border-purple-400/20 bg-purple-500/10 p-5">
            <p className="text-xs font-bold tracking-[0.24em] text-purple-200 uppercase">
              Prochaine action
            </p>
            <h2 className="mt-3 text-xl font-bold text-white">Avancer dans l’audit Optivos</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Le parcours suit les preuves publiées : compréhension, processus, analyse,
              opportunités, ROI, plan d’action puis résultats.
            </p>
            {primaryCompany && (
              <Link
                href={`/companies/${primaryCompany.id}/automation-audit`}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-950"
              >
                Continuer l’audit <ArrowRight size={16} />
              </Link>
            )}
          </aside>
        </section>
      )}
    </div>
  );
}

function PilotMetric({
  icon,
  label,
  value,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-blue-200">
        {icon}
        <p className="text-xs font-bold tracking-[0.16em] uppercase">{label}</p>
      </div>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function PilotState({
  title,
  text,
  action,
  tone = "default",
}: {
  readonly title: string;
  readonly text: string;
  readonly action?: ReactNode;
  readonly tone?: "default" | "error";
}) {
  return (
    <section
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-[1.75rem] border p-8 text-center ${
        tone === "error"
          ? "border-red-400/30 bg-red-500/10 text-red-100"
          : "border-white/10 bg-slate-900/80 text-slate-200"
      }`}
    >
      <Building2 className="mx-auto text-blue-300" size={42} />
      <h2 className="mt-4 text-2xl font-bold text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-300">{text}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </section>
  );
}
