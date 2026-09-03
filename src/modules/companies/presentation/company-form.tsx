"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { companyInputSchema } from "../application/company-schemas";
import { companySizes, companyStatuses } from "../domain/company";
import type { CompanyView } from "./company-view";

const creationFields = [
  ["name", "Nom de l’entreprise", true, "text"],
  ["sectorId", "Secteur", false, "text"],
] as const;

const editFields = [
  ...creationFields,
  ["employeeCount", "Nombre d’employés", false, "number"],
  ["country", "Pays", false, "text"],
  ["primaryContactName", "Contact principal", false, "text"],
  ["primaryContactRole", "Fonction du contact", false, "text"],
  ["phone", "Téléphone", false, "text"],
  ["email", "E-mail", false, "email"],
  ["website", "Site web", false, "url"],
  ["address", "Adresse", false, "text"],
  ["city", "Ville", false, "text"],
] as const;

const sizeLabels: Record<(typeof companySizes)[number], string> = {
  micro: "Microentreprise",
  small: "Petite entreprise",
  medium: "Moyenne entreprise",
  large: "Grande entreprise",
  enterprise: "Grande organisation",
};

export function CompanyForm({ company }: { company?: CompanyView }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(undefined);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const validation = companyInputSchema.safeParse(values);

    if (!validation.success) {
      setPending(false);
      setMessage(validation.error.issues[0]?.message ?? "Vérifiez les informations saisies.");
      return;
    }

    const response = await fetch(company ? `/api/companies/${company.id}` : "/api/companies", {
      method: company ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validation.data),
    });
    setPending(false);

    if (!response.ok) {
      setMessage("L’entreprise n’a pas pu être enregistrée.");
      return;
    }

    const payload = (await response.json()) as { data: { id: string } };
    setMessage("Entreprise enregistrée.");
    window.setTimeout(() => {
      router.push(`/companies/${payload.data.id}`);
      router.refresh();
    }, 600);
  }

  return (
    <Card className="mx-auto max-w-5xl overflow-hidden border-white/10 bg-slate-900/80 text-slate-50 shadow-2xl shadow-slate-950/30">
      <CardHeader className="border-b border-white/10 bg-gradient-to-br from-slate-900 to-blue-950/40 p-6 sm:p-7">
        <p className="opt-eyebrow">
          {company ? "Dossier entreprise" : "Première étape · 2 minutes"}
        </p>
        <CardTitle className="mt-2 font-['Manrope'] text-3xl font-extrabold">
          {company ? "Modifier l’entreprise" : "Créer mon entreprise"}
        </CardTitle>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          {company
            ? "Ajustez les informations utiles à votre audit."
            : "Deux informations suffisent pour ouvrir votre espace. Les questions métier viendront ensuite, une étape à la fois."}
        </p>
      </CardHeader>
      <CardContent className="p-6 sm:p-8">
        <form className="space-y-6" onSubmit={submit}>
          <div className="grid gap-5 md:grid-cols-2">
            {(company ? editFields : creationFields).map(([name, label, required, type]) => (
              <div className={name === "address" ? "md:col-span-2" : undefined} key={name}>
                <Label className="text-slate-200" htmlFor={name}>
                  {label}
                </Label>
                <Input
                  className="opt-input mt-2 border-white/10 bg-slate-950/60"
                  id={name}
                  name={name}
                  required={required}
                  type={type}
                  min={name === "employeeCount" ? 0 : undefined}
                  defaultValue={company?.[name] ?? ""}
                />
              </div>
            ))}
            {company ? (
              <div>
                <Label className="text-slate-200" htmlFor="companySize">
                  Taille
                </Label>
                <select
                  id="companySize"
                  name="companySize"
                  defaultValue={company.companySize ?? ""}
                  className="opt-select mt-2 h-11 px-3 text-sm"
                >
                  <option value="">Non renseignée</option>
                  {companySizes.map((size) => (
                    <option key={size} value={size}>
                      {sizeLabels[size]}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {company ? (
              <div>
                <Label className="text-slate-200" htmlFor="status">
                  Statut
                </Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={company.status}
                  className="opt-select mt-2 h-11 px-3 text-sm"
                >
                  {companyStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input type="hidden" name="status" value="client" />
            )}
            <div className="md:col-span-2">
              <Label className="text-slate-200" htmlFor="description">
                En une phrase, que fait votre entreprise ?{" "}
                <span className="text-slate-500">(facultatif)</span>
              </Label>
              <Textarea
                className="opt-textarea mt-2 min-h-32 resize-y border-white/10 bg-slate-950/60 p-4 leading-6 text-slate-50"
                id="description"
                name="description"
                defaultValue={company?.description ?? ""}
                placeholder="Ex. Nous gérons un hôtel de 20 chambres et accueillons principalement des voyageurs d’affaires."
              />
              <p className="mt-2 text-xs text-slate-500">
                Pas besoin d’être exhaustif : vous préciserez le fonctionnement pendant l’audit.
              </p>
            </div>
            {company ? (
              <div className="md:col-span-2">
                <Label className="text-slate-200" htmlFor="internalNotes">
                  Notes privées
                </Label>
                <Textarea
                  className="opt-textarea mt-2 border-white/10 bg-slate-950/60"
                  id="internalNotes"
                  name="internalNotes"
                  defaultValue={company.internalNotes ?? ""}
                />
              </div>
            ) : null}
          </div>
          {message && (
            <p
              className="fixed right-4 bottom-4 z-50 rounded-md bg-neutral-950 px-4 py-3 text-sm text-white shadow-lg"
              role="status"
            >
              {message}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button
              className="opt-secondary"
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Annuler
            </Button>
            <Button className="opt-primary" type="submit" disabled={pending}>
              {pending ? "Création…" : company ? "Enregistrer" : "Créer mon espace et continuer"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
