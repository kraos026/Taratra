import { describe, expect, it, vi } from "vitest";
import type { AssistedAuditReadModel } from "../application/assisted-audit-model";
import {
  createActionLock,
  performAuditCommand,
  performAuditCommandAndRefresh,
  presentNextAction,
  presentProcessCandidateAction,
} from "./assisted-audit-action-plan";

describe("Assisted Audit presentation action plan", () => {
  it("navigates Discovery to the existing canonical screen", () => {
    expect(presentNextAction(model("DISCOVERY", "START_DISCOVERY"), "company")).toMatchObject({
      kind: "navigate",
      href: "/companies/company/discovery",
    });
  });

  it("navigates Interview to the existing canonical screen", () => {
    expect(presentNextAction(model("INTERVIEW", "CONTINUE_INTERVIEW"), "company")).toMatchObject({
      kind: "navigate",
      href: "/companies/company/interview",
    });
  });

  it("uses the real M3.1 endpoint to build Knowledge", () => {
    expect(presentNextAction(model("KNOWLEDGE", "BUILD_KNOWLEDGE"), "company")).toMatchObject({
      kind: "command",
      request: { url: "/api/companies/company/knowledge-snapshots", init: { method: "POST" } },
    });
  });

  it("uses real artifact IDs for lifecycle commands", () => {
    const result = presentNextAction(
      model("PROCESS_MAP", "PUBLISH_PROCESS_MAP", {
        id: "real-process-map-id",
        version: 2,
        status: "validated",
        lockVersion: 7,
      }),
      "company",
    );
    expect(result).toMatchObject({
      kind: "command",
      request: {
        url: "/api/process-maps/real-process-map-id/publish",
        init: { body: JSON.stringify({ lockVersion: 7 }) },
      },
    });
  });

  it("opens the ROI assumptions screen with real Automation Opportunity and ROI IDs", () => {
    const value = model("ROI", "ENTER_ROI_ASSUMPTIONS", {
      id: "real-roi-id",
      version: 2,
      status: "draft",
      lockVersion: 1,
    });
    value.stages.unshift({
      stage: "AUTOMATION_OPPORTUNITIES",
      label: "Automation Opportunities",
      status: "COMPLETED",
      artifact: { id: "real-opportunity-id", version: 1, status: "published" },
      candidateArtifacts: [],
      availableActions: [],
      blockingReason: null,
    });
    expect(presentNextAction(value, "company")).toMatchObject({
      kind: "navigate",
      label: "Complete ROI assumptions",
      href: "/companies/company/automation-audit/roi/real-opportunity-id?roiId=real-roi-id",
    });
  });

  it("keeps Process Map ambiguity as an explicit selection", () => {
    expect(
      presentProcessCandidateAction({
        id: "candidate-from-api",
        version: 1,
        status: "published",
        lockVersion: 2,
      }),
    ).toMatchObject({
      kind: "command",
      request: { url: "/api/process-maps/candidate-from-api/analyze" },
    });
  });

  it("refreshes the read model after a successful Knowledge command", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    await performAuditCommandAndRefresh(
      { url: "/api/companies/company/knowledge-snapshots", init: { method: "POST" } },
      refresh,
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("surfaces safe API failures", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Validated Discovery is required" } }), {
        status: 409,
      }),
    );
    await expect(
      performAuditCommand({ url: "/command", init: { method: "POST" } }, fetcher),
    ).rejects.toThrow("Validated Discovery is required");
  });

  it("prevents duplicate submission while an action is in flight", () => {
    const lock = createActionLock();
    expect(lock.acquire()).toBe(true);
    expect(lock.acquire()).toBe(false);
    lock.release();
    expect(lock.acquire()).toBe(true);
  });
});

function model(
  currentStage: AssistedAuditReadModel["currentStage"],
  nextAction: AssistedAuditReadModel["nextAction"],
  artifact: AssistedAuditReadModel["stages"][number]["artifact"] = null,
): AssistedAuditReadModel {
  return {
    company: { id: "company", name: "Company" },
    overallStatus: "NOT_STARTED",
    currentStage,
    nextAction,
    blockingReason: null,
    stages: [
      {
        stage: currentStage,
        label: "Current stage",
        status: "NOT_STARTED",
        artifact,
        candidateArtifacts: [],
        availableActions: nextAction ? [nextAction] : [],
        blockingReason: null,
      },
    ],
  };
}
