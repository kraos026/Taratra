import { Suspense } from "react";
import { CompaniesList } from "@/modules/companies/presentation/companies-list";

export default function CompaniesPage() {
  return (
    <Suspense fallback={<p className="text-neutral-500">Chargement…</p>}>
      <CompaniesList />
    </Suspense>
  );
}
