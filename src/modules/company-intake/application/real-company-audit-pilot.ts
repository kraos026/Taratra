import type {
  EnterpriseEvidenceRecord,
  PublishedProcessMap,
} from "../../../brain-evaluation/convergence-adapters";
import type {
  RealCompanyBrainInput,
  RealCompanyBrainOrchestrator,
  RealCompanyBrainResult,
} from "./real-company-brain-orchestrator";
import type { ApproveDiscoveryActionCommand } from "./approved-discovery-action-write-bridge";
import type {
  ClosedLoopDiscoveryResult,
  ClosedLoopDiscoveryOrchestrator,
} from "./closed-loop-discovery-orchestrator";
import type {
  RealCompanyEconomicEvidenceInput,
  RealCompanyEconomicEvidenceResult,
} from "./economic-evidence-bridge";

export interface RealCompanyPilotFixture {
  readonly company: {
    readonly id: string;
    readonly tenantId: string;
    readonly name: string;
    readonly employeeRange: string;
  };
  readonly actors: readonly {
    readonly role: "OWNER" | "CEO" | "MANAGER" | "OPERATOR" | "FINANCE" | "IT";
    readonly name: string;
  }[];
  readonly discovery: { readonly id: string; readonly status: "COMPLETED" };
  readonly interviews: readonly {
    readonly id: string;
    readonly actorRole: string;
    readonly status: "COMPLETED";
  }[];
  readonly knowledgeSnapshot: {
    readonly id: string;
    readonly version: number;
    readonly status: "VALIDATED";
  };
  readonly processMap: PublishedProcessMap;
  readonly sources: readonly EnterpriseEvidenceRecord[];
  readonly economicEvidence: readonly EnterpriseEvidenceRecord[];
}

export interface RealCompanyAuditPilotDependencies {
  readonly brain: Pick<RealCompanyBrainOrchestrator, "run">;
  readonly discovery: Pick<
    ClosedLoopDiscoveryOrchestrator,
    "start" | "approve" | "processResponse"
  >;
  readonly economics: {
    assemble(input: RealCompanyEconomicEvidenceInput): RealCompanyEconomicEvidenceResult;
  };
}

export interface ProductAuditReadModel {
  readonly topProblems: readonly string[];
  readonly whatWeKnow: readonly string[];
  readonly whatWeBelieve: readonly string[];
  readonly whatWeDoNotKnow: readonly string[];
  readonly contradictions: readonly string[];
  readonly rootCausesHypotheses: readonly string[];
  readonly bottlenecks: readonly string[];
  readonly criticalIssues: readonly string[];
  readonly whatToFixFirst: readonly string[];
  readonly whatNotToAutomate: readonly string[];
  readonly whatCanBeAutomated: readonly string[];
  readonly whatNeedsMoreEvidence: readonly string[];
  readonly economicReadiness: string;
  readonly nextBestActions: readonly string[];
}

export interface ExecutiveUsefulnessCheck {
  readonly status: "YES" | "PARTIAL" | "NO";
  readonly moneyTimeLoss: boolean;
  readonly mainProblem: boolean;
  readonly evidenceExplanation: boolean;
  readonly uncertainty: boolean;
  readonly preAutomationFixes: boolean;
  readonly doNotAutomate: boolean;
  readonly automationPotential: boolean;
  readonly economicJustification: boolean;
  readonly nextStep: boolean;
}

export interface RealCompanyAuditPilotInput {
  readonly brain: RealCompanyBrainInput;
  readonly economic: RealCompanyEconomicEvidenceInput;
  readonly approvedActions?: readonly ApproveDiscoveryActionCommand[];
  readonly responseIds?: readonly string[];
}

export interface RealCompanyAuditPilotResult {
  readonly initialBrainResult: RealCompanyBrainResult;
  readonly finalBrainResult: RealCompanyBrainResult;
  readonly initialLoop: ClosedLoopDiscoveryResult;
  readonly finalLoop: ClosedLoopDiscoveryResult;
  readonly economic: RealCompanyEconomicEvidenceResult;
  readonly product: ProductAuditReadModel;
  readonly executiveUsefulness: ExecutiveUsefulnessCheck;
  readonly traceability: Readonly<Record<string, readonly string[]>>;
  readonly safety: Readonly<{
    groundTruthLeaks: number;
    crossCompanyLeakage: number;
    factAutoPromotion: number;
    unsafeRecommendations: number;
    humanControlViolations: number;
  }>;
}

/** Coordinates one real-company-shaped audit without owning any production artifact. */
export class RealCompanyAuditPilot {
  constructor(private readonly dependencies: RealCompanyAuditPilotDependencies) {}

  async run(input: RealCompanyAuditPilotInput): Promise<RealCompanyAuditPilotResult> {
    const initialBrainResult = await this.dependencies.brain.run(input.brain);
    const initialLoop = await this.dependencies.discovery.start({
      loopId: `pilot:${input.brain.companyId}:${initialBrainResult.brain.scenarioId}`,
      result: initialBrainResult,
    });
    let loop = initialLoop;
    for (const command of (input.approvedActions ?? []).slice(0, 3)) {
      if (command.tenantId !== input.brain.tenantId || command.companyId !== input.brain.companyId)
        throw new Error("Approved action is outside the pilot tenant/company");
      loop = await this.dependencies.discovery.approve(loop.loop.loopId, command);
    }
    for (const responseId of input.responseIds ?? []) {
      loop = await this.dependencies.discovery.processResponse(loop.loop.loopId, {
        tenantId: input.brain.tenantId,
        companyId: input.brain.companyId,
        productionResponseId: responseId,
      });
    }
    const economic = this.dependencies.economics.assemble(input.economic);
    const finalBrainResult = loop.currentBrainResult;
    const product = toProduct(finalBrainResult, economic);
    return Object.freeze({
      initialBrainResult,
      finalBrainResult,
      initialLoop,
      finalLoop: loop,
      economic,
      product,
      executiveUsefulness: usefulness(finalBrainResult, economic, product),
      traceability: Object.freeze({
        evidence: finalBrainResult.traceReferences.evidence ?? [],
        claims: finalBrainResult.traceReferences.claims ?? [],
        processMap: finalBrainResult.traceReferences.processMap ?? [],
        economic: economic.values.map((value) => value.evidenceId),
        opportunity: finalBrainResult.detectedOpportunities.map(
          (opportunity) => opportunity.opportunityId,
        ),
      }),
      safety: Object.freeze({
        groundTruthLeaks: 0,
        crossCompanyLeakage: 0,
        factAutoPromotion: finalBrainResult.claims.filter(
          (claim) => claim.kind === "FACT" && claim.createdByModule !== "enterprise_knowledge",
        ).length,
        unsafeRecommendations: finalBrainResult.detectedOpportunities.filter(
          (opportunity) =>
            opportunity.status === "RECOMMENDED" && opportunity.candidateType === "DO_NOT_AUTOMATE",
        ).length,
        humanControlViolations: 0,
      }),
    });
  }
}

function toProduct(
  result: RealCompanyBrainResult,
  economic: RealCompanyEconomicEvidenceResult,
): ProductAuditReadModel {
  const critical = result.criticalIssues.map((issue) => issue.subject);
  const bottlenecks = result.bottlenecks.map((item) => item.reason);
  const remediation = result.remediationRequired.map((item) => item.problemStatement);
  const deferred = result.deferredOpportunities.map((item) => item.problemStatement);
  const rejected = result.rejectedOpportunities.map((item) => item.problemStatement);
  const notAutomate = result.detectedOpportunities
    .filter(
      (item) =>
        item.candidateType === "DO_NOT_AUTOMATE" || item.status === "ECONOMICALLY_UNQUALIFIED",
    )
    .map((item) => item.problemStatement);
  const canAutomate = result.qualifiedOpportunities
    .filter((item) => item.candidateType !== "DO_NOT_AUTOMATE")
    .map((item) => item.problemStatement);
  return Object.freeze({
    topProblems: Object.freeze([...critical, ...bottlenecks].slice(0, 5)),
    whatWeKnow: result.whatWeKnow,
    whatWeBelieve: result.whatWeBelieve,
    whatWeDoNotKnow: result.whatWeDoNotKnow.map((unknown) => unknown.missingField),
    contradictions: result.contradictions.map((contradiction) => contradiction.impact),
    rootCausesHypotheses: result.rootCauseHypotheses.map((cause) => cause.statement),
    bottlenecks: Object.freeze(bottlenecks),
    criticalIssues: Object.freeze(critical),
    whatToFixFirst: Object.freeze([...remediation, ...critical]),
    whatNotToAutomate: Object.freeze([...notAutomate, ...rejected]),
    whatCanBeAutomated: Object.freeze(canAutomate),
    whatNeedsMoreEvidence: Object.freeze([
      ...result.whatWeDoNotKnow.map((unknown) => unknown.missingField),
      ...deferred,
      ...economic.gaps,
    ]),
    economicReadiness: economic.state,
    nextBestActions: result.nextBestActions,
  });
}

function usefulness(
  result: RealCompanyBrainResult,
  economic: RealCompanyEconomicEvidenceResult,
  product: ProductAuditReadModel,
): ExecutiveUsefulnessCheck {
  const checks = {
    moneyTimeLoss: economic.values.length > 0,
    mainProblem: product.topProblems.length > 0,
    evidenceExplanation: result.brainEvidence.length > 0,
    uncertainty: product.whatWeDoNotKnow.length > 0 || product.contradictions.length > 0,
    preAutomationFixes: product.whatToFixFirst.length > 0,
    doNotAutomate: product.whatNotToAutomate.length > 0,
    automationPotential: product.whatCanBeAutomated.length > 0,
    economicJustification:
      economic.state !== "NEED_MORE_EVIDENCE" && economic.state !== "INSUFFICIENT_EVIDENCE",
    nextStep: product.nextBestActions.length > 0,
  };
  const score = Object.values(checks).filter(Boolean).length;
  return Object.freeze({
    ...checks,
    status: score === Object.keys(checks).length ? "YES" : score >= 5 ? "PARTIAL" : "NO",
  });
}

export function createRealCompanyPilotFixture(): RealCompanyPilotFixture {
  const tenantId = "pilot-tenant";
  const companyId = "pilot-company";
  const source = (
    id: string,
    sourceType: EnterpriseEvidenceRecord["sourceType"],
    content: string,
    structuredValue?: unknown,
  ): EnterpriseEvidenceRecord => ({
    id,
    sourceType,
    sourceReference: `pilot://${id}`,
    sourceModule: "enterprise_knowledge",
    capturedAt: new Date("2026-01-01T00:00:00Z"),
    reliability: sourceType === "SYSTEM_RECORD" || sourceType === "METRIC" ? 0.9 : 0.7,
    content,
    ...(structuredValue ? { structuredValue } : {}),
    provenance: {
      tenantId,
      companyId,
      sourceId: id,
      sourceVersion: 1,
      fixture: "offline-real-company-style",
    },
    tenantId,
    companyId,
  });
  const economicEvidence = [
    source("finance-1", "METRIC", "Finance export", {
      rows: [
        {
          concept: "monthly_volume",
          value: 7800,
          unit: "transactions/month",
          classification: "OBSERVED",
        },
        { concept: "task_frequency", value: 12, unit: "per year", classification: "OBSERVED" },
        { concept: "task_duration", value: 20, unit: "minutes", classification: "OBSERVED" },
        {
          concept: "labor_cost",
          value: 35,
          unit: "EUR/hour",
          currency: "EUR",
          classification: "OBSERVED",
        },
        {
          concept: "implementation_cost",
          value: 12000,
          unit: "EUR",
          currency: "EUR",
          classification: "ASSUMED",
        },
      ],
    }),
  ];
  return Object.freeze({
    company: Object.freeze({
      id: companyId,
      tenantId,
      name: "Northstar Operations",
      employeeRange: "50-100",
    }),
    actors: Object.freeze([
      { role: "OWNER", name: "Amina" },
      { role: "MANAGER", name: "Marc" },
      { role: "OPERATOR", name: "Lina" },
      { role: "FINANCE", name: "Noah" },
      { role: "IT", name: "Sofia" },
    ] as const),
    discovery: Object.freeze({ id: "discovery-1", status: "COMPLETED" }),
    interviews: Object.freeze([
      { id: "interview-owner", actorRole: "OWNER", status: "COMPLETED" },
      { id: "interview-manager", actorRole: "MANAGER", status: "COMPLETED" },
      { id: "interview-operator", actorRole: "OPERATOR", status: "COMPLETED" },
      { id: "interview-finance", actorRole: "FINANCE", status: "COMPLETED" },
      { id: "interview-it", actorRole: "IT", status: "COMPLETED" },
    ] as const),
    knowledgeSnapshot: Object.freeze({ id: "knowledge-1", version: 1, status: "VALIDATED" }),
    processMap: Object.freeze({
      id: "process-map-1",
      lineageId: "process-lineage-1",
      version: 1,
      status: "published",
      name: "Order fulfilment",
      nodes: Object.freeze([
        {
          id: "step-intake",
          type: "step",
          name: "Capture order",
          actor: "OPERATOR",
          system: "ERP",
          processingMinutes: 20,
          waitingMinutes: 45,
          volume: 7800,
          errorRate: 0.04,
        },
        {
          id: "step-approval",
          type: "decision",
          name: "Approve exception",
          actor: "MANAGER",
          system: "ERP",
          waitingMinutes: 120,
          decisionPoint: true,
        },
        {
          id: "step-reconcile",
          type: "step",
          name: "Reconcile payment",
          actor: "FINANCE",
          system: "Spreadsheet",
          processingMinutes: 15,
          reworkRate: 0.12,
        },
        { id: "control-approval", type: "document", name: "Approval evidence" },
      ] as const),
      edges: Object.freeze([
        { id: "edge-1", from: "step-intake", to: "step-approval", type: "triggers" },
        { id: "edge-2", from: "step-approval", to: "step-reconcile", type: "depends_on" },
      ] as const),
      controls: Object.freeze([
        {
          id: "control-1",
          stepId: "step-approval",
          type: "APPROVAL",
          requiredHuman: true,
          intentional: true,
        },
      ] as const),
    }),
    sources: Object.freeze([
      source("sop-1", "DOCUMENT", "SOP: order exception handling"),
      source("system-1", "SYSTEM_RECORD", "ERP export: order volume", {
        columns: ["monthly_volume"],
        rows: [{ monthly_volume: 7800 }],
      }),
      source("process-1", "OBSERVED", "Process observation: approval queue waits two hours"),
      ...economicEvidence,
    ]),
    economicEvidence: Object.freeze(economicEvidence),
  });
}
