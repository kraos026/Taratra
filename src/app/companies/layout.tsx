import { CompanyShell } from "@/components/dashboard/company-shell";

export default function CompaniesLayout({ children }: { children: React.ReactNode }) {
  return <CompanyShell>{children}</CompanyShell>;
}
