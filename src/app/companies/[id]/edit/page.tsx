import { CompanyEditLoader } from "@/modules/companies/presentation/company-edit-loader";

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto max-w-4xl">
      <CompanyEditLoader id={(await params).id} />
    </div>
  );
}
