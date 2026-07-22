"use client";
import { useMemo, useState } from "react";
import type { ReportRecommendation } from "../domain/audit-report";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
const labels = {
  quick_win: "Quick Win",
  strategic: "Strategic",
  nice_to_have: "Nice to Have",
  low_priority: "Low Priority",
};
export function RecommendationsTable({
  items,
  currency,
}: {
  items: ReportRecommendation[];
  currency: string | null;
}) {
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);
  const size = 10;
  const filtered = useMemo(
    () =>
      items.filter(
        (x) =>
          (!priority || x.priority === priority) &&
          `${x.title} ${x.category}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [items, priority, query],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const visible = filtered.slice((page - 1) * size, page * size);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recommandations</CardTitle>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            aria-label="Rechercher une recommandation"
            placeholder="Rechercher"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
          <select
            aria-label="Filtrer par priorité"
            className="rounded-md border px-3 dark:bg-neutral-900"
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Toutes les priorités</option>
            {Object.entries(labels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                {[
                  "Priorité",
                  "Titre",
                  "Catégorie",
                  "ROI",
                  "Temps gagné",
                  "Coût",
                  "Payback",
                  "Statut",
                ].map((h) => (
                  <th className="p-3" scope="col" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr className="border-b" key={r.id}>
                  <td className="p-3 font-medium">{labels[r.priority]}</td>
                  <td className="p-3">{r.title}</td>
                  <td className="p-3">{r.category}</td>
                  <td className="p-3">{r.roiPercentage.toFixed(1)} %</td>
                  <td className="p-3">{r.hoursYear.toFixed(1)} h/an</td>
                  <td className="p-3">
                    {r.implementationCost.toLocaleString("fr-FR")} {currency}
                  </td>
                  <td className="p-3">
                    {r.paybackMonths === null ? "—" : `${r.paybackMonths.toFixed(1)} mois`}
                  </td>
                  <td className="p-3">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length && (
            <p className="py-10 text-center text-neutral-500">
              Aucune recommandation ne correspond aux filtres.
            </p>
          )}
        </div>
        <nav
          aria-label="Pagination des recommandations"
          className="mt-4 flex items-center justify-end gap-3"
        >
          <button
            className="rounded border px-3 py-2 disabled:opacity-40"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Précédent
          </button>
          <span>
            Page {page} / {pages}
          </span>
          <button
            className="rounded border px-3 py-2 disabled:opacity-40"
            disabled={page === pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </button>
        </nav>
      </CardContent>
    </Card>
  );
}
