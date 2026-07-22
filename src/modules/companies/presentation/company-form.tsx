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

const fields = [
  ["name", "Nom", true],
  ["sectorId", "Secteur", false],
  ["employeeCount", "Nombre d’employés", false],
  ["primaryContactName", "Contact principal", false],
  ["primaryContactRole", "Fonction du contact", false],
  ["phone", "Téléphone", false],
  ["email", "E-mail", false],
  ["website", "Site web", false],
  ["address", "Adresse", false],
  ["city", "Ville", false],
  ["country", "Pays", false],
] as const;

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
    <Card>
      <CardHeader>
        <CardTitle>{company ? "Modifier l’entreprise" : "Nouvelle entreprise"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={submit}>
          <div className="grid gap-5 md:grid-cols-2">
            {fields.map(([name, label, required]) => (
              <div className={name === "address" ? "md:col-span-2" : undefined} key={name}>
                <Label htmlFor={name}>{label}</Label>
                <Input
                  className="mt-2"
                  id={name}
                  name={name}
                  required={required}
                  type={
                    name === "employeeCount"
                      ? "number"
                      : name === "email"
                        ? "email"
                        : name === "website"
                          ? "url"
                          : "text"
                  }
                  min={name === "employeeCount" ? 0 : undefined}
                  defaultValue={company?.[name] ?? ""}
                />
              </div>
            ))}
            <div>
              <Label htmlFor="companySize">Taille</Label>
              <select
                id="companySize"
                name="companySize"
                defaultValue={company?.companySize ?? ""}
                className="mt-2 h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm"
              >
                <option value="">Non renseignée</option>
                {companySizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="status">Statut</Label>
              <select
                id="status"
                name="status"
                defaultValue={company?.status ?? "prospect"}
                className="mt-2 h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm"
              >
                {companyStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                className="mt-2"
                id="description"
                name="description"
                defaultValue={company?.description ?? ""}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="internalNotes">Notes internes</Label>
              <Textarea
                className="mt-2"
                id="internalNotes"
                name="internalNotes"
                defaultValue={company?.internalNotes ?? ""}
              />
            </div>
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
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
