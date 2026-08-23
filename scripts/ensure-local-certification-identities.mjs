import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import {
  LOCAL_E2E_USERS,
  assertLocalCertificationEnv,
  certificationEnvFromProcess,
} from "./local-certification-support.mjs";

const env = certificationEnvFromProcess();
assertLocalCertificationEnv(env);

if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("LOCAL CERTIFICATION IDENTITIES: missing SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const database = new pg.Client({ connectionString: env.DATABASE_URL });
await database.connect();

try {
  for (const tenant of [LOCAL_E2E_USERS.tenantA, LOCAL_E2E_USERS.tenantB]) {
    const userId = await ensureUser(tenant.email, tenant.password);
    const organizationId = await ensureOrganization(tenant.organizationName);
    await ensureMembership(organizationId, userId);
    await ensureCompany(organizationId, tenant.companyName);
  }
  console.log("LOCAL CERTIFICATION IDENTITIES: Tenant A = PRESENT");
  console.log("LOCAL CERTIFICATION IDENTITIES: Tenant B = PRESENT");
  console.log("LOCAL CERTIFICATION IDENTITIES: organizations = PRESENT");
  console.log("LOCAL CERTIFICATION IDENTITIES: companies = PRESENT");
} finally {
  await database.end();
}

async function ensureUser(email, password) {
  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (!created.error && created.data.user?.id) return created.data.user.id;

  const listed = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error) {
    throw new Error(`LOCAL CERTIFICATION IDENTITIES: user lookup failed: ${listed.error.message}`);
  }

  const existing = listed.data.users.find((user) => user.email?.toLowerCase() === email);
  if (!existing) {
    throw new Error(
      `LOCAL CERTIFICATION IDENTITIES: user creation failed: ${created.error?.message ?? "unknown"}`,
    );
  }

  const updated = await supabase.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  });
  if (updated.error) {
    throw new Error(`LOCAL CERTIFICATION IDENTITIES: user update failed: ${updated.error.message}`);
  }
  return existing.id;
}

async function ensureOrganization(name) {
  const existing = await database.query(
    `select id from public.organizations where name = $1 and deleted_at is null limit 1`,
    [name],
  );
  if (existing.rows[0]?.id) return existing.rows[0].id;

  const inserted = await database.query(
    `insert into public.organizations(name) values($1) returning id`,
    [name],
  );
  return inserted.rows[0].id;
}

async function ensureMembership(organizationId, userId) {
  await database.query(
    `delete from public.organization_members
     where user_id = $1 and organization_id <> $2`,
    [userId, organizationId],
  );
  await database.query(
    `insert into public.organization_members(organization_id, user_id, role)
     values($1, $2, 'owner')
     on conflict (organization_id, user_id)
     do update set role = 'owner', updated_at = now()`,
    [organizationId, userId],
  );
}

async function ensureCompany(organizationId, name) {
  const existing = await database.query(
    `select id from public.companies where organization_id = $1 and name = $2 and deleted_at is null limit 1`,
    [organizationId, name],
  );
  if (existing.rows[0]?.id) return existing.rows[0].id;

  const inserted = await database.query(
    `insert into public.companies(organization_id, name) values($1, $2) returning id`,
    [organizationId, name],
  );
  return inserted.rows[0].id;
}
