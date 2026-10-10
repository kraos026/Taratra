import { companyIdSchema } from "@/modules/companies/application/company-schemas";
import { validationError, withCompanyService } from "@/modules/companies/presentation/company-api";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const id = companyIdSchema.safeParse((await context.params).id);
  const response = !id.success
    ? validationError("Identifiant d’entreprise invalide")
    : await withCompanyService(
        "companies.exportProfile",
        async (service) =>
          new Response(JSON.stringify(await service.exportProfile(id.data), null, 2), {
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              // The validated UUID is used instead of untrusted company names.
              "Content-Disposition": `attachment; filename="optivos-profil-${id.data}.json"`,
            },
          }),
      );
  // Apply to authentication/permission errors as well as successful downloads.
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
