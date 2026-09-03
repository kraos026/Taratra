import { Badge } from "@/components/ui/badge";
import type { CompanyStatus } from "../domain/company";

const labels: Record<CompanyStatus, string> = {
  prospect: "Dossier à compléter",
  contacted: "Dossier en préparation",
  audit_scheduled: "Audit planifié",
  audit_in_progress: "Audit en cours",
  client: "Dossier actif",
  archived: "Archivé",
};

export function CompanyStatusBadge({
  status,
  archived,
}: {
  status: CompanyStatus;
  archived?: boolean;
}) {
  return (
    <Badge className={archived ? "bg-neutral-100 text-neutral-600" : undefined}>
      {archived ? "Archivée" : labels[status]}
    </Badge>
  );
}
