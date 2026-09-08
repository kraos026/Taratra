"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Building2,
  CircleGauge,
  Pencil,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyStatusBadge } from "./company-status-badge";
import type { CompanyDetailResponse } from "./company-view";
import type { AssistedAuditReadModel } from "@/modules/assisted-audit/application/assisted-audit-model";
import {
  currentJourneyLabel,
  customerStatusLabel,
} from "@/modules/assisted-audit/presentation/canonical-journey";

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
  const [auditData, setAudit] = useState<AssistedAuditReadModel | null>(null);
  const audit = auditData?.company.id === id ? auditData : null;

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/companies/${id}/automation-audit`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as { data?: AssistedAuditReadModel };
        if (!controller.signal.aborted && payload.data?.company.id === id) setAudit(payload.data);
      })
      .catch(() => {
        /* The company remains readable; no lifecycle state is inferred. */
      });
    return () => controller.abort();
  }, [id]);

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
    if (!company || !window.confirm(`Confirmer l’action sur ${brandText(company.name)} ?`)) return;
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
  const companyName = brandText(company.name);
  const location = [company.city, company.country].filter(Boolean).join(", ");
  const profileFacts = [
    ["Secteur", company.sectorId ?? "À préciser"],
    ["Taille", sizeLabel(company.companySize)],
    ["Employés", company.employeeCount ? `${company.employeeCount}` : "À préciser"],
    ["Localisation", location || "À préciser"],
  ];
  const attentionItems = [
    company.description ? null : "Contexte métier à compléter",
    company.sectorId ? null : "Secteur à préciser",
    company.employeeCount || company.companySize ? null : "Taille d’équipe à préciser",
  ].filter((item): item is string => Boolean(item));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/70 p-6 shadow-2xl shadow-blue-950/20 sm:p-8">
        <Link
          className="mb-5 flex items-center gap-2 text-sm text-blue-300 hover:text-blue-100"
          href="/companies"
        >
          <ArrowLeft size={15} /> Retour à Mon entreprise
        </Link>
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold tracking-[0.28em] text-blue-300 uppercase">
              <Sparkles size={15} /> Espace entreprise
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="font-['Manrope'] text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
                {companyName}
              </h1>
              <CompanyStatusBadge status={company.status} archived={Boolean(company.deletedAt)} />
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
              Votre espace de pilotage : contexte entreprise, état de l’audit et prochaines actions
              à traiter avant décision.
            </p>
          </div>
          {!company.deletedAt && (
            <Link
              href={`/companies/${id}/automation-audit`}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-400"
            >
              Continuer l’audit <ArrowRight size={17} />
            </Link>
          )}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {profileFacts.map(([label, value]) => (
          <ExecutiveMetric key={label} label={label} value={String(value)} />
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-white/10 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20">
          <CardHeader>
            <p className="opt-eyebrow">État de l’audit</p>
            <CardTitle className="font-['Manrope'] text-2xl">Parcours Optivos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatusPanel
                icon={<CircleGauge size={18} />}
                label="Progression"
                value={audit ? customerStatusLabel(audit.overallStatus) : "État indisponible"}
              />
              <StatusPanel
                icon={<Building2 size={18} />}
                label="Étape actuelle"
                value={audit ? currentJourneyLabel(audit) : "À consulter dans l’audit"}
              />
              <StatusPanel
                icon={<ShieldAlert size={18} />}
                label="Points d’attention"
                value={`${attentionItems.length}`}
              />
            </div>
            <p className="text-sm leading-6 text-slate-300">
              Continuez l’audit pour consolider les processus, les opportunités, le ROI et le plan
              d’action à partir des données publiées.
            </p>
            {!company.deletedAt && (
              <Link
                href={`/companies/${id}/automation-audit`}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-400"
              >
                Continuer l’audit <ArrowRight size={16} />
              </Link>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20">
          <CardHeader>
            <p className="opt-eyebrow">Informations à surveiller</p>
            <CardTitle className="font-['Manrope'] text-2xl">Contexte et risques</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {attentionItems.length > 0 ? (
              attentionItems.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100"
                >
                  {item}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                Les informations clés de l’entreprise sont renseignées.
              </div>
            )}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-bold tracking-[0.18em] text-slate-400 uppercase">
                Description
              </p>
              <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-slate-200">
                {company.description
                  ? brandText(company.description)
                  : "À compléter lors de la compréhension."}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-wrap gap-3">
        {permissions.canWrite && !company.deletedAt && (
          <Button
            className="opt-secondary"
            variant="outline"
            onClick={() => router.push(`/companies/${id}/edit`)}
          >
            <Pencil size={16} /> Modifier le dossier
          </Button>
        )}
        {permissions.canWrite && (
          <Button
            className="opt-secondary"
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
            className="border-red-400/30 text-red-200 hover:bg-red-500/10"
            onClick={() => void action("delete")}
          >
            <Trash2 size={16} /> Supprimer
          </Button>
        )}
      </section>
    </div>
  );
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
  return value ? (labels[value] ?? value) : "À préciser";
}

function ExecutiveMetric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20">
      <p className="text-xs font-bold tracking-[0.18em] text-slate-500 uppercase">{label}</p>
      <p className="mt-2 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function StatusPanel({
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
