import { describe, expect, it, vi } from "vitest";
import {
  buildRoiRequest,
  canEditRoi,
  emptyAssumptions,
  restoreAssumptions,
  roiAssumptionFields,
  saveAndRefreshRoi,
  saveRoiAssumptions,
  type RoiDetail,
} from "./roi-assumptions-form";
import type { AssistedAuditReadModel } from "@/modules/assisted-audit/application/assisted-audit-model";

function detail(): RoiDetail {
  return {
    snapshot: {
      id: "real-roi-v1",
      currency: "EUR",
      lockVersion: 7,
      status: "draft",
      provenanceJson: {
        assumptionInputs: [
          { code: "hourly_cost", status: "known", value: 42 },
          { code: "maintenance_cost", status: "known", value: 0 },
          { code: "training_cost", status: "unknown" },
        ],
      },
    },
    metrics: [],
  };
}

function validRequest() {
  const values = emptyAssumptions();
  for (const { code } of roiAssumptionFields) values[code] = { unknown: false, value: "1" };
  return buildRoiRequest("EUR", values);
}

describe("customer ROI assumptions", () => {
  it("exposes every real public assumption without financial defaults", () => {
    expect(roiAssumptionFields.map(({ code }) => code)).toEqual([
      "working_days",
      "working_hours",
      "monthly_frequency",
      "annual_frequency",
      "hourly_cost",
      "implementation_cost",
      "maintenance_cost",
      "training_cost",
      "infrastructure_cost",
      "error_cost",
      "hours_saved_per_occurrence",
    ]);
    expect(Object.values(emptyAssumptions()).every((value) => value.value === "")).toBe(true);
  });

  it("requires currency and known values", () => {
    const result = buildRoiRequest("", emptyAssumptions());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.currency).toBeTruthy();
      expect(result.errors.hourly_cost).toBeTruthy();
    }
  });

  it("keeps known positive, known zero and UNKNOWN distinct", () => {
    const values = emptyAssumptions();
    for (const { code } of roiAssumptionFields) values[code] = { unknown: true, value: "" };
    values.hourly_cost = { unknown: false, value: "35" };
    values.maintenance_cost = { unknown: false, value: "0" };
    const result = buildRoiRequest("EUR", values);
    expect(result).toMatchObject({
      success: true,
      data: {
        assumptions: {
          hourly_cost: { status: "known", value: 35 },
          maintenance_cost: { status: "known", value: 0 },
          training_cost: { status: "unknown" },
        },
      },
    });
    if (result.success) expect(result.data.assumptions.training_cost).not.toHaveProperty("value");
  });

  it("restores known values, known zero and UNKNOWN from the existing draft", () => {
    const restored = restoreAssumptions(detail());
    expect(restored.hourly_cost).toEqual({ unknown: false, value: "42" });
    expect(restored.maintenance_cost).toEqual({ unknown: false, value: "0" });
    expect(restored.training_cost).toEqual({ unknown: true, value: "" });
  });

  it("uses initial creation only when no ROI draft exists", async () => {
    const request = validRequest();
    expect(request.success).toBe(true);
    if (!request.success) return;
    const fetcher = okFetcher("new-roi");
    await saveRoiAssumptions(
      { opportunityId: "real-automation-opportunity", roi: null, request: request.data },
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      "/api/automation-opportunities/real-automation-opportunity/roi",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("revises an existing draft with its real ID and lockVersion", async () => {
    const request = validRequest();
    expect(request.success).toBe(true);
    if (!request.success) return;
    const fetcher = okFetcher("roi-v2");
    await saveRoiAssumptions(
      { opportunityId: "opportunity", roi: detail(), request: request.data },
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      "/api/roi/real-roi-v1/revise",
      expect.objectContaining({ body: expect.stringContaining('"lockVersion":7') }),
    );
    expect(fetcher).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/automation-opportunities/"),
      expect.anything(),
    );
  });

  it("surfaces the stable conflict without retrying or overwriting", async () => {
    const request = validRequest();
    expect(request.success).toBe(true);
    if (!request.success) return;
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: "ROI_CONFLICT", message: "Modified elsewhere" } }),
          { status: 409, headers: { "content-type": "application/json" } },
        ),
      );
    await expect(
      saveRoiAssumptions(
        { opportunityId: "opportunity", roi: detail(), request: request.data },
        fetcher,
      ),
    ).rejects.toMatchObject({ status: 409, code: "ROI_CONFLICT" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("keeps viewers read-only using server-derived available actions", () => {
    expect(canEditRoi(auditModel([]), detail())).toBe(false);
    expect(canEditRoi(auditModel(["ENTER_ROI_ASSUMPTIONS"]), detail())).toBe(true);
  });

  it("refreshes Assisted Audit after save and takes the next action from the server", async () => {
    const request = validRequest();
    expect(request.success).toBe(true);
    if (!request.success) return;
    const refreshed = auditModel(["VALIDATE_ROI"]);
    refreshed.nextAction = "VALIDATE_ROI";
    refreshed.stages[0]!.artifact = {
      id: "roi-v2",
      version: 2,
      status: "draft",
      lockVersion: 1,
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ id: "roi-v2" }, 201))
      .mockResolvedValueOnce(response(refreshed))
      .mockResolvedValueOnce(
        response({ ...detail(), snapshot: { ...detail().snapshot, id: "roi-v2" } }),
      );
    const result = await saveAndRefreshRoi(
      {
        companyId: "company",
        opportunityId: "real-opportunity",
        roi: null,
        request: request.data,
      },
      fetcher,
    );
    expect(result.model.nextAction).toBe("VALIDATE_ROI");
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/automation-opportunities/real-opportunity/roi",
      "/api/companies/company/automation-audit",
      "/api/roi/roi-v2",
    ]);
  });

  it("does not refresh or advance the audit after an API failure", async () => {
    const request = validRequest();
    expect(request.success).toBe(true);
    if (!request.success) return;
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "Validation failed" } }), { status: 422 }),
      );
    await expect(
      saveAndRefreshRoi(
        { companyId: "company", opportunityId: "opportunity", roi: null, request: request.data },
        fetcher,
      ),
    ).rejects.toThrow("Validation failed");
    expect(fetcher).toHaveBeenCalledOnce();
  });
});

function auditModel(
  availableActions: AssistedAuditReadModel["stages"][number]["availableActions"],
): AssistedAuditReadModel {
  return {
    company: { id: "company", name: "Company" },
    overallStatus: "IN_PROGRESS",
    currentStage: "ROI",
    nextAction: availableActions[0] ?? null,
    blockingReason: null,
    stages: [
      {
        stage: "ROI",
        label: "ROI",
        status: "IN_PROGRESS",
        artifact: { id: "real-roi-v1", version: 1, status: "draft", lockVersion: 7 },
        candidateArtifacts: [],
        availableActions,
        blockingReason: null,
      },
    ],
  };
}

function okFetcher(id: string) {
  return vi.fn().mockResolvedValue(response({ id }, 201));
}

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
