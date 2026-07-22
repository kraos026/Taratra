import { CompanyDetail } from "@/modules/companies/presentation/company-detail";

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  return <CompanyDetail id={(await params).id} />;
}
