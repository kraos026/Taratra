export async function knowledgeCounts(db, organizationId, snapshotId) {
  const counts = {};
  for (const table of ["knowledge_sources", "knowledge_facts", "knowledge_nodes"]) {
    const result = await db.query(
      `select count(*)::int as count from public.${table} where organization_id = $1 and snapshot_id = $2`,
      [organizationId, snapshotId],
    );
    counts[table] = Number(result.rows[0].count);
  }
  return counts;
}

export async function assertForeignCompanyDenied(request, companyId) {
  for (const suffix of ["", "/automation-audit/results", "/automation-audit/decision-center"]) {
    const response = await request.get(`/api/companies/${companyId}${suffix}`);
    // A 401 is not isolation evidence: it means Tenant B was not authenticated.
    if (response.status() !== 404)
      throw new Error(
        `Tenant B isolation failed for ${suffix || "company"}: expected 404, got ${response.status()}`,
      );
  }
}
