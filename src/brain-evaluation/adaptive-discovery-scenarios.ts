import {
  Claim,
  Contradiction,
  DeterministicConfidenceModel,
  Evidence,
  UnknownInformation,
  type EvidenceInput,
} from "./brain-contracts";
import type { BrainDiscoveryState, InterviewBudget } from "./adaptive-discovery";
import type { ClarificationRequirement } from "./uncertainty-engine";

const now = new Date("2026-08-13T00:00:00.000Z");
const confidenceModel = new DeterministicConfidenceModel();

const defaultBudget: InterviewBudget = Object.freeze({
  maximumQuestions: 5,
  maximumQuestionsPerDomain: 3,
  minimumValueThreshold: 0.1,
  alreadyAskedQuestionIds: Object.freeze([]),
  questionsAskedByDomain: Object.freeze({}),
});

export const missingRoiVolumeState = state({
  evidence: [
    evidence({
      evidenceId: "evidence:process-identified",
      content: "Invoice process is identified and plausible for automation.",
      structuredValue: { processIdentified: true },
    }),
  ],
  unknowns: [
    unknown({
      unknownId: "unknown:roi-volume",
      missingField: "transactionVolume",
      domain: "roi",
      impact: "ROI cannot be evaluated without transaction volume.",
      requiredFor: ["roi", "recommendation"],
      priority: "HIGH",
    }),
  ],
  decisionDependencies: [
    {
      decisionId: "decision:roi-readiness",
      target: "roi",
      claimIds: [],
      unknownIds: ["unknown:roi-volume"],
    },
  ],
});

export const objectiveEvidencePreferredState = state({
  evidence: [
    evidence({
      evidenceId: "evidence:manager-estimate",
      sourceType: "INTERVIEW",
      sourceReference: "interview:manager",
      content: "Manager estimates 70 orders per day.",
      structuredValue: { transactionVolume: 70 },
      reliability: 0.65,
    }),
  ],
  unknowns: [
    unknown({
      unknownId: "unknown:validated-volume",
      missingField: "validatedTransactionVolume",
      domain: "roi",
      impact: "System logs are available and should validate the subjective estimate.",
      requiredFor: ["roi", "recommendation"],
      priority: "HIGH",
    }),
  ],
});

export const redundantQuestionState = state({
  evidence: [
    evidence({
      evidenceId: "evidence:volume-system",
      sourceType: "SYSTEM_RECORD",
      sourceReference: "system:orders",
      content: "System logs show 410 orders per month.",
      structuredValue: { transactionVolume: 410 },
      reliability: 0.95,
    }),
    evidence({
      evidenceId: "evidence:volume-metric",
      sourceType: "METRIC",
      content: "BI report confirms 405 orders per month.",
      structuredValue: { transactionVolume: 405 },
      reliability: 0.9,
    }),
  ],
  claims: [
    claim({
      claimId: "claim:volume-supported",
      statement: "Transaction volume is strongly supported.",
      supportingEvidenceIds: ["evidence:volume-system", "evidence:volume-metric"],
    }),
  ],
});

export const nonMaterialUnknownState = state({
  unknowns: [
    unknown({
      unknownId: "unknown:minor-label",
      missingField: "internalNickname",
      domain: "finding",
      impact: "Internal nickname is not required for downstream analysis.",
      requiredFor: ["finding"],
      priority: "LOW",
    }),
  ],
  budget: { ...defaultBudget, minimumValueThreshold: 0.8 },
});

export const criticalContradictionState = state({
  evidence: [
    evidence({
      evidenceId: "evidence:owner-70",
      sourceType: "INTERVIEW",
      sourceReference: "interview:owner",
      content: "Owner reports 70 orders per day.",
      structuredValue: { ordersPerDay: 70 },
      reliability: 0.7,
    }),
    evidence({
      evidenceId: "evidence:operator-25",
      sourceType: "INTERVIEW",
      sourceReference: "interview:operator",
      content: "Operator reports 25 orders per day.",
      structuredValue: { ordersPerDay: 25 },
      reliability: 0.8,
    }),
  ],
  claims: [
    claim({
      claimId: "claim:owner-70",
      statement: "Daily order volume is 70.",
      supportingEvidenceIds: ["evidence:owner-70"],
    }),
    claim({
      claimId: "claim:operator-25",
      statement: "Daily order volume is 25.",
      supportingEvidenceIds: ["evidence:operator-25"],
    }),
  ],
  contradictions: [
    Contradiction.create({
      contradictionId: "contradiction:critical-volume",
      kind: "QUANTITATIVE",
      leftClaimId: "claim:owner-70",
      rightClaimId: "claim:operator-25",
      leftEvidenceIds: ["evidence:owner-70"],
      rightEvidenceIds: ["evidence:operator-25"],
      materiality: "CRITICAL",
      impact: "Critical ROI volume conflict.",
      requiresClarification: true,
      detectedAt: now,
    }),
  ],
  clarifications: [
    Object.freeze({
      clarificationId: "clarification:critical-volume",
      targetSubject: "ordersPerDay",
      reason: "Critical ROI volume conflict.",
      affectedDecisions: Object.freeze(["roi"] as const),
      priority: "CRITICAL",
      requiredEvidenceType: "METRIC",
      suggestedQuestionOrAction: "Retrieve POS/order logs for the last 30 days.",
    }) satisfies ClarificationRequirement,
  ],
  decisionDependencies: [
    {
      decisionId: "decision:roi",
      target: "roi",
      claimIds: ["claim:owner-70", "claim:operator-25"],
      unknownIds: [],
    },
  ],
});

export const budgetExhaustedState = state({
  unknowns: [
    unknown({
      unknownId: "unknown:processing-time",
      missingField: "processingTime",
      domain: "roi",
      impact: "Processing time is required for ROI.",
      requiredFor: ["roi"],
      priority: "HIGH",
    }),
  ],
  budget: {
    ...defaultBudget,
    maximumQuestions: 1,
    alreadyAskedQuestionIds: Object.freeze([
      "question:gap:unknown:processing-time:system_data_request",
    ]),
  },
});

export const multipleGapsState = state({
  unknowns: [
    unknown({
      unknownId: "unknown:minor-owner",
      missingField: "actorOwnership",
      domain: "finding",
      impact: "Actor ownership is useful but not ROI-blocking.",
      requiredFor: ["finding"],
      priority: "LOW",
    }),
    unknown({
      unknownId: "unknown:error-rate",
      missingField: "errorRate",
      domain: "roi",
      impact: "Error rate affects ROI and recommendation value.",
      requiredFor: ["roi", "recommendation"],
      priority: "HIGH",
    }),
  ],
});

function state(input: Partial<BrainDiscoveryState>): BrainDiscoveryState {
  return Object.freeze({
    evidence: Object.freeze([...(input.evidence ?? [])]),
    claims: Object.freeze([...(input.claims ?? [])]),
    unknowns: Object.freeze([...(input.unknowns ?? [])]),
    contradictions: Object.freeze([...(input.contradictions ?? [])]),
    clarifications: Object.freeze([...(input.clarifications ?? [])]),
    decisionDependencies: Object.freeze([...(input.decisionDependencies ?? [])]),
    budget: Object.freeze(input.budget ?? defaultBudget),
  });
}

function evidence(input: Partial<EvidenceInput> & Pick<EvidenceInput, "evidenceId" | "content">) {
  return Evidence.create({
    sourceType: "OBSERVED",
    sourceReference: "fixture:adaptive-discovery",
    sourceModule: "brain_evaluation",
    capturedAt: now,
    freshness: "CURRENT",
    reliability: 0.8,
    provenance: { fixture: "adaptive-discovery" },
    ...input,
  });
}

function unknown(input: {
  unknownId: string;
  missingField: string;
  domain: string;
  impact: string;
  requiredFor: readonly string[];
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}) {
  return UnknownInformation.create({
    ...input,
    reason: "Information not yet supplied or validated",
    suggestedClarification: `Resolve ${input.missingField}.`,
  });
}

function claim(input: {
  claimId: string;
  statement: string;
  supportingEvidenceIds: readonly string[];
}) {
  return Claim.create({
    claimId: input.claimId,
    kind: "FACT",
    statement: input.statement,
    supportingEvidenceIds: input.supportingEvidenceIds,
    confidence: confidenceModel.calculate({
      supportingEvidenceCount: input.supportingEvidenceIds.length,
      averageSourceReliability: 0.85,
      sourceAgreement: 0.9,
      freshness: 1,
      directness: 1,
      contradictionPenalty: 0,
      missingDataPenalty: 0,
    }),
    rationale: "Adaptive discovery fixture claim",
    createdByModule: "brain_evaluation",
    createdAt: now,
    lastEvaluatedAt: now,
  });
}
