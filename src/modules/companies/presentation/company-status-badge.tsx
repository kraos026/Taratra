import { Badge } from "@/components/ui/badge";
import type { CompanyStatus } from "../domain/company";

const labels: Record<CompanyStatus, string> = {
  prospect: "Prospect",
  contacted: "Contacté",
  audit_scheduled: "Audit planifié",
  audit_in_progress: "Audit en cours",
  client: "Client",
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
