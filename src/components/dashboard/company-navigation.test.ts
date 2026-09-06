import { afterEach, describe, expect, it, vi } from "vitest";
import type { AssistedAuditReadModel } from "@/modules/assisted-audit/application/assisted-audit-model";
import {
  companyIdFromPath,
  companyNavigationHref,
  loadCompanyNavigation,
} from "./company-navigation";

const companyId = "11111111-1111-4111-8111-111111111111";
const audit = `/companies/${companyId}/automation-audit`;
function publishedModel(): AssistedAuditReadModel {
  return {
    company: { id: companyId, name: "Test company" },
    overallStatus: "COMPLETED",
    currentStage: "COMPLETED",
    nextAction: "VIEW_RESULTS",
    blockingReason: null,
    stages: (["AUTOMATION_OPPORTUNITIES", "ROI", "RECOMMENDATIONS"] as const).map((stage) => ({
      stage,
      label: stage,
      status: "COMPLETED",
      artifact: { id: `${stage}-id`, version: 1, status: "published" },
      candidateArtifacts: [],
      availableActions: [],
      blockingReason: null,
    })),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("company navigation", () => {
  it("recognizes company routes without treating creation as a company", () => {
    expect(companyIdFromPath(`${audit}/results`)).toBe(companyId);
    expect(companyIdFromPath(`/companies/${companyId}`)).toBe(companyId);
    for (const route of ["/companies", "/companies/new", `/companies/${companyId}extra`]) {
      expect(companyIdFromPath(route)).toBeNull();
    }
  });

  it("links every downstream entry to the current published artifact", () => {
    const model = publishedModel();
    const expected = {
      "Mon entreprise": `/companies/${companyId}`,
      Audit: audit,
      Opportunités: "/automation-opportunities/AUTOMATION_OPPORTUNITIES-id",
      ROI: "/roi/ROI-id",
      "Plan d’action": "/recommendations/RECOMMENDATIONS-id",
      Résultats: `${audit}/results`,
    };
    for (const [label, href] of Object.entries(expected)) {
      expect(companyNavigationHref(companyId, model, label, "/companies")).toBe(href);
    }
    expect(companyNavigationHref(companyId, model, "Vue d’ensemble", "/")).toBe("/");
  });

  it("never carries previous-company links into a new company", () => {
    const model = publishedModel();
    model.company.id = "another-company";
    for (const label of ["Opportunités", "ROI", "Plan d’action", "Résultats"]) {
      expect(companyNavigationHref(companyId, model, label, "/companies")).toBe(audit);
      expect(companyNavigationHref(companyId, null, label, "/companies")).toBe(audit);
    }
  });

  it("does not expose draft or missing artifacts", () => {
    const model = publishedModel();
    model.stages[0]!.artifact!.status = "draft";
    model.stages[1]!.artifact = null;
    model.currentStage = "RECOMMENDATIONS";
    expect(companyNavigationHref(companyId, model, "Opportunités", "/")).toBe(audit);
    expect(companyNavigationHref(companyId, model, "ROI", "/")).toBe(audit);
    expect(companyNavigationHref(companyId, model, "Résultats", "/")).toBe(audit);
    expect(companyNavigationHref(null, model, "ROI", "/companies")).toBe("/companies");
  });

  it("loads only the existing read endpoint with cancellation and no caching", async () => {
    const model = publishedModel();
    const fetch = vi.fn().mockResolvedValue(Response.json({ data: model }));
    vi.stubGlobal("fetch", fetch);
    const signal = new AbortController().signal;
    expect(await loadCompanyNavigation(companyId, signal)).toEqual(model);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(`/api/companies/${companyId}/automation-audit`, {
      cache: "no-store",
      signal,
    });
  });

  it("rejects denied or mismatched read models", async () => {
    const model = publishedModel();
    model.company.id = "another-company";
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(Response.json({ data: model }));
    vi.stubGlobal("fetch", fetch);
    expect(await loadCompanyNavigation(companyId, new AbortController().signal)).toBeNull();
    expect(await loadCompanyNavigation(companyId, new AbortController().signal)).toBeNull();
  });
});
