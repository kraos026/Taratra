import "server-only";
import { createClient } from "@/infrastructure/supabase/server";
import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { PrismaCompanyRepository } from "@/modules/companies/infrastructure/prisma-company-repository";
import { canWriteCompanies } from "@/modules/companies/domain/company-permissions";
import { agentLabEnabled } from "../application/agent-workspace-policy";

export async function agentCompanyContext() {
  if (!agentLabEnabled()) return new Response(null, { status: 404 });
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    const userId = data?.claims?.sub;
    if (error || !userId) return new Response(null, { status: 401 });
    const organization = await withAuthenticatedDatabase(userId, (db) =>
      new PrismaCompanyRepository(db).getOrganizationContext(userId),
    );
    if (!organization) return new Response(null, { status: 403 });
    return {
      client,
      userId,
      organizationId: organization.organizationId,
      canWrite: canWriteCompanies(organization.role),
    };
  } catch {
    return new Response(null, { status: 503 });
  }
}
