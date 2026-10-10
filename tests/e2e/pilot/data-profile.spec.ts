import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { loginAsTenantA, loginAsTenantB } from "./support/auth";
import { createCertificationCompany } from "./support/company";
import { pilotBrowserContextOptions, readPilotE2EConfig } from "./support/env";

const config = readPilotE2EConfig(process.env);

test("local fictitious profile export, archive and deletion preserve tenant isolation", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  // This mutation test must never fall back to remote credentials or a Preview.
  test.skip(
    !config ||
      config.baseUrl !== "http://localhost:3000" ||
      process.env.AUTOMATEX_CERTIFICATION_DB !== "true" ||
      process.env.AUTOMATEX_CERTIFICATION_TARGET !== "local",
    "LOCAL FICTITIOUS DATA ONLY",
  );
  const database = new URL(process.env.DATABASE_URL!);
  expect(["127.0.0.1", "localhost"]).toContain(database.hostname);
  expect(database.port).toBe("55022");

  const aContext = await browser.newContext(pilotBrowserContextOptions(config!));
  const bContext = await browser.newContext(pilotBrowserContextOptions(config!));
  try {
    const a = await aContext.newPage();
    const b = await bContext.newPage();
    await loginAsTenantA(a, config!);
    await loginAsTenantB(b, config!);
    // Only these same-run empty fixtures are deleted; not certification baseline companies.
    const aId = await createCertificationCompany(a, `Privacy local A ${Date.now()}`);
    const bId = await createCertificationCompany(b, `Privacy local B ${Date.now()}`);
    const forbidden = await b.request.get(`/api/companies/${aId}/export`);
    expect([403, 404]).toContain(forbidden.status());
    expect([403, 404]).toContain(
      (await b.request.get(`/api/companies/${aId}/audit-export`)).status(),
    );
    expect([403, 404]).toContain((await b.request.delete(`/api/companies/${aId}`)).status());
    expect((await a.request.get(`/api/companies/${aId}`)).status()).toBe(200);

    await a.goto("/settings");
    await expect(a.getByRole("heading", { name: "Vos données et votre compte" })).toBeVisible();
    await expect(
      a.getByText("Ce fichier contient uniquement le profil", { exact: false }),
    ).toBeVisible();
    await a.goto(`/companies/${aId}`);
    const downloadEvent = a.waitForEvent("download");
    await a.getByRole("link", { name: "Télécharger le profil (JSON)" }).click();
    expect((await downloadEvent).suggestedFilename()).toBe(`optivos-profil-${aId}.json`);
    const sourceDownload = a.waitForEvent("download");
    await a.getByRole("link", { name: "Télécharger les sources d’audit (JSON)" }).click();
    expect((await sourceDownload).suggestedFilename()).toBe(`optivos-sources-audit-${aId}.json`);

    expect((await a.request.post(`/api/companies/${aId}/archive`)).status()).toBe(200);
    const exported = await a.request.get(`/api/companies/${aId}/export`);
    expect(exported.status()).toBe(200);
    expect(exported.headers()["cache-control"]).toContain("no-store");
    const profile = await exported.json();
    expect(profile.scope).toBe("company_profile_only");
    expect(profile.company.id).toBe(aId);
    expect(profile.company.archivedAt).not.toBeNull();
    expect(profile.company).not.toHaveProperty("organizationId");
    expect(profile.excluded).toContain("auth");
    expect(profile.company.id).not.toBe(bId);

    // Audits cannot be attached to archived companies; restore this fixture first.
    expect((await a.request.post(`/api/companies/${aId}/restore`)).status()).toBe(200);

    // A draft audit is a genuine FK dependency, not a mocked repository error.
    // Insert and remove only this identified fictitious local row, never real audits.
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    const auditId = randomUUID();
    const discoveryId = randomUUID();
    const documentSourceId = randomUUID();
    await client.connect();
    try {
      // Newly created synthetic source only, with live tenant ownership.
      await client.query(
        `insert into public.discovery_sessions (id, organization_id, company_id, started_by)
         select $1, c.organization_id, c.id, m.user_id from public.companies c
         join public.organization_members m on m.organization_id = c.organization_id
         where c.id = $2 limit 1`,
        [discoveryId, aId],
      );
      await client.query(
        `insert into public.discovery_answers (organization_id, discovery_session_id, step, field_key, value_json, answered_by)
         select organization_id, id, 'company', 'privacy_fixture_zero', '0'::jsonb, started_by
         from public.discovery_sessions where id = $1 and company_id = $2`,
        [discoveryId, aId],
      );
      await client.query(
        `insert into public.audit_production_evidence_sources
         (id, organization_id, company_id, source_key, source_version, source_type, origin, raw_content, received_at)
         select $1, organization_id, id, 'privacy_fixture', 1, 'DOCUMENT', 'local-certification',
         'Synthetic local document only', now() from public.companies where id = $2`,
        [documentSourceId, aId],
      );
      await client.query(
        `insert into public.audit_production_evidence_records
         (organization_id, company_id, source_id, evidence_key, content, confidence)
         select organization_id, company_id, id, 'privacy_fixture', 'Synthetic local evidence only', 0
         from public.audit_production_evidence_sources where id = $1 and company_id = $2`,
        [documentSourceId, aId],
      );
      const sourceResponse = await a.request.get(`/api/companies/${aId}/audit-export`);
      expect(sourceResponse.status()).toBe(200);
      expect(sourceResponse.headers()["cache-control"]).toContain("no-store");
      const sources = await sourceResponse.json();
      expect(sources.scope).toBe("audit_sources_and_current_summary");
      expect(sources.formatVersion).toBe(2);
      expect(sources.discoverySessions).toHaveLength(1);
      expect(sources.discoverySessions[0].id).toBe(discoveryId);
      expect(sources.discoverySessions[0]).not.toHaveProperty("startedBy");
      expect(sources.discoveryAnswers[0].valueJson).toBe(0);
      expect(sources.documentSources[0].rawContent).toBe("Synthetic local document only");
      expect(sources.documentSources[0]).not.toHaveProperty("metadataJson");
      expect(sources.acquiredEvidence[0].sourceId).toBe(documentSourceId);
      expect(Number(sources.acquiredEvidence[0].confidence)).toBe(0);
      expect(sources.currentSummary.complete).toBe(false);
      expect(sources.currentSummary.company.id).toBe(aId);
      expect(sources.currentSummary.roi).toBeNull();
      const canonicalResponse = await a.request.get(
        `/api/companies/${aId}/automation-audit/results`,
      );
      expect(canonicalResponse.status()).toBe(200);
      const canonical = (await canonicalResponse.json()).data;
      expect(sources.currentSummary.overview).toEqual(canonical.overview);
      expect(sources.currentSummary.provenance).toEqual(canonical.provenance);
      expect(sources.excluded).toContain("complete_historical_artifacts_and_roi_calculations");
      expect([403, 404]).toContain(
        (await b.request.get(`/api/companies/${aId}/audit-export`)).status(),
      );
      const inserted = await client.query(
        "insert into public.audits (id, organization_id, company_id) select $1, organization_id, id from public.companies where id = $2",
        [auditId, aId],
      );
      expect(inserted.rowCount).toBe(1);
      const refused = await a.request.delete(`/api/companies/${aId}`);
      expect(refused.status()).toBe(409);
      expect((await refused.json()).error.code).toBe("COMPANY_HAS_DEPENDENCIES");
      expect((await a.request.get(`/api/companies/${aId}/export`)).status()).toBe(200);
      const retained = await client.query(
        "select id from public.audits where id = $1 and company_id = $2",
        [auditId, aId],
      );
      expect(retained.rowCount).toBe(1);
    } finally {
      await client.query(
        "delete from public.audit_production_evidence_records where source_id = $1 and company_id = $2",
        [documentSourceId, aId],
      );
      await client.query(
        "delete from public.audit_production_evidence_sources where id = $1 and company_id = $2",
        [documentSourceId, aId],
      );
      await client.query(
        "delete from public.discovery_sessions where id = $1 and company_id = $2",
        [discoveryId, aId],
      );
      await client.query("delete from public.audits where id = $1 and company_id = $2", [
        auditId,
        aId,
      ]);
      await client.end();
    }

    expect((await a.request.delete(`/api/companies/${aId}`)).status()).toBe(200);
    expect((await a.request.get(`/api/companies/${aId}/export`)).status()).toBe(404);
    expect((await b.request.get(`/api/companies/${bId}`)).status()).toBe(200);
    expect((await b.request.delete(`/api/companies/${bId}`)).status()).toBe(200);
  } finally {
    await aContext.close();
    await bContext.close();
  }
});
