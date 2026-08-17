import { describe, expect, it } from "vitest";
import {
  ApprovedDiscoveryActionWriteBridge,
  type ActionExecutionRecord,
  type ApprovedDiscoveryActionPorts,
} from "./index";
import type { AdaptiveDiscoveryPlan } from "./application/adaptive-discovery-production-bridge";

const intent = {
  gapId: "gap:approval-delay",
  targetSource: "MANAGER_INTERVIEW" as const,
  businessConcept: "approval delay",
  reason: "Contradictory causal reports",
  expectedEvidenceType: "INTERVIEW" as const,
  materiality: "HIGH" as const,
  decisionBlocked: true,
  traceability: {
    companyId: "company-a",
    tenantId: "tenant-a",
    unknownIds: [],
    contradictionIds: ["contradiction:approval"],
    evidenceIds: ["evidence:operator"],
    affectedDecisionIds: ["decision:root-cause"],
  },
};

const plan: AdaptiveDiscoveryPlan = {
  companyId: "company-a",
  tenantId: "tenant-a",
  brainRunReference: "brain:run-1",
  contextReferences: { knowledgeSnapshotId: "knowledge:1", processMapId: "process:1" },
  materialGaps: [],
  recommendedActions: [
    {
      questionId: "question:approval-delay:clarification",
      targetSource: "MANAGER_INTERVIEW",
      questionIntent: intent,
      naturalWording: "How does approval affect processing time?",
      whyThisMatters: "Resolve the causal contradiction",
      decisionUnlocked: ["decision:root-cause"],
      priority: "HIGH",
      evidenceRequested: "INTERVIEW",
      valueScore: 0.9,
    },
  ],
  stoppingReason: "Material gap remains",
  readiness: {
    outcome: "CONTINUE_DISCOVERY",
    rationale: "Material gap remains",
    blockingGapIds: ["gap:approval-delay"],
    declaredUncertaintyGapIds: [],
  },
  remainingQuestionBudget: 9,
};

function ports(
  overrides: Partial<ApprovedDiscoveryActionPorts> = {},
): ApprovedDiscoveryActionPorts {
  const records = new Map<string, ActionExecutionRecord>();
  return {
    loadPlan: async () => plan,
    currentContext: async () => ({
      brainRunId: "brain:run-1",
      knowledgeSnapshotId: "knowledge:1",
      processMapId: "process:1",
    }),
    findExecution: async (id) => records.get(id) ?? null,
    saveExecution: async (record) => void records.set(record.executionId, record),
    ...overrides,
  };
}

describe("ApprovedDiscoveryActionWriteBridge", () => {
  it("writes one canonical interview question after explicit approval", async () => {
    let calls = 0;
    const bridge = new ApprovedDiscoveryActionWriteBridge(
      ports({
        createInterviewQuestion: async () => {
          calls += 1;
          return { reference: "interview-question:1" };
        },
      }),
    );
    const command = {
      tenantId: "tenant-a",
      companyId: "company-a",
      brainRunId: "brain:run-1",
      actionId: "question:approval-delay:clarification",
      approvedBy: "user-1",
    };
    const first = await bridge.approve(command);
    const second = await bridge.approve(command);
    expect(first.status).toBe("EXECUTED");
    expect(second.executionId).toBe(first.executionId);
    expect(calls).toBe(1);
  });

  it("allows wording edits but ignores caller attempts to change intent", async () => {
    let received: string | undefined;
    const bridge = new ApprovedDiscoveryActionWriteBridge(
      ports({
        createInterviewQuestion: async ({ question, target }) => {
          received = `${target}:${question}`;
          return { reference: "question:2" };
        },
      }),
    );
    const result = await bridge.approve({
      tenantId: "tenant-a",
      companyId: "company-a",
      brainRunId: "brain:run-1",
      actionId: "question:approval-delay:clarification",
      approvedBy: "user-1",
      editedHumanWording: "Can you walk me through the approval wait?",
      // No target/evidence fields exist in the command, so they cannot be overridden.
    });
    expect(result.originalQuestionIntent.targetSource).toBe("MANAGER_INTERVIEW");
    expect(received).toContain("MANAGER_INTERVIEW");
    expect(received).toContain("approval wait");
  });

  it("records rejection without a production write", async () => {
    let writes = 0;
    const bridge = new ApprovedDiscoveryActionWriteBridge(
      ports({
        saveExecution: async () => void writes++,
      }),
    );
    const result = await bridge.reject({
      tenantId: "tenant-a",
      companyId: "company-a",
      brainRunId: "brain:run-1",
      actionId: "question:approval-delay:clarification",
      rejectedBy: "user-1",
      reasonCode: "ALREADY_KNOWN",
    });
    expect(result.status).toBe("REJECTED");
    expect(writes).toBe(1);
  });

  it("rejects stale and cross-company actions", async () => {
    const stale = new ApprovedDiscoveryActionWriteBridge(
      ports({ currentContext: async () => ({ brainRunId: "brain:old" }) }),
    );
    const staleResult = await stale.approve({
      tenantId: "tenant-a",
      companyId: "company-a",
      brainRunId: "brain:run-1",
      actionId: "question:approval-delay:clarification",
      approvedBy: "user-1",
    });
    expect(staleResult.status).toBe("STALE");

    const foreign = new ApprovedDiscoveryActionWriteBridge(
      ports({ loadPlan: async () => ({ ...plan, tenantId: "tenant-b" }) }),
    );
    await expect(
      foreign.approve({
        tenantId: "tenant-a",
        companyId: "company-a",
        brainRunId: "brain:run-1",
        actionId: "question:approval-delay:clarification",
        approvedBy: "user-1",
      }),
    ).rejects.toThrow();
  });
});
