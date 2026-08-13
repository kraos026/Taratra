import { describe, expect, it } from "vitest";
import { ReasoningTrace } from "./brain-contracts";
import {
  OpportunityCandidate,
  AutomationSuitabilityAssessment,
  AISuitabilityAssessment,
  TechnicalFeasibilityAssessment,
  ProcessReadinessAssessment,
  DataReadinessAssessment,
  OpportunityRiskAssessment,
  OpportunityDecisionEngine,
  OpportunityIntelligenceEngine,
} from "./opportunity-intelligence";
const trace = ReasoningTrace.create({ evidence: "Evidence", opportunity: "Opportunity" }, [
  { fromId: "evidence", toId: "opportunity", relationship: "supports", rationale: "test" },
]);
const candidate = OpportunityCandidate.create({
  opportunityId: "o1",
  subject: "Manual re-entry",
  problemStatement: "copying",
  targetOutcome: "reduce errors",
  currentState: "manual",
  desiredState: "structured",
  candidateType: "AUTOMATION",
  confidence: 0.8,
  trace,
  valueSignals: { frequency: 80, volume: 500, timeConsumed: 40 },
});
const suit = new AutomationSuitabilityAssessment().assess(candidate.valueSignals, {
  ruleClarity: 0.9,
  inputStructure: 0.9,
  outputStructure: 0.9,
  exceptionRate: 0.1,
  decisionComplexity: 0.1,
  humanJudgmentDependency: 0.1,
  dataAvailability: 0.9,
  processStability: 0.9,
  integrationAvailability: 0.9,
  controlRequirements: 0.2,
  currentManualEffort: 80,
});
const feasible = new TechnicalFeasibilityAssessment().assess({
  requiredCapabilities: ["API"],
  knownCapabilities: ["API"],
  integrationAvailable: 0.9,
  apiWrite: 0.9,
  dataAccessible: 0.9,
  authentication: 0.9,
  trigger: 0.9,
  batch: 0.8,
  humanApproval: 0.2,
  observability: 0.8,
});
const process = new ProcessReadinessAssessment().assess({
  ownership: 1,
  definition: 1,
  variation: 0.1,
  rootCause: 1,
  dataQuality: 1,
  contradiction: 0,
  exceptions: 0.1,
  controls: 1,
});
const data = new DataReadinessAssessment().assess({
  availability: 1,
  completeness: 1,
  consistency: 1,
  structure: 1,
  freshness: 1,
  sourceOfTruth: 1,
  accessibility: 1,
  traceability: 1,
});
const risk = new OpportunityRiskAssessment().assess({
  operationalRisk: 0.1,
  dataRisk: 0.1,
  securityRisk: 0.1,
  complianceRisk: 0.1,
  financialRisk: 0.1,
  vendorDependencyRisk: 0.1,
  changeManagementRisk: 0.2,
  failureImpact: 0.2,
  reversibility: 0.9,
});
describe("B2.5 opportunity intelligence", () => {
  it("recommends a sufficiently evidenced stable candidate", () => {
    const d = new OpportunityIntelligenceEngine().evaluate({
      candidate,
      suitability: suit,
      feasibility: feasible,
      process,
      data,
      risk,
      evidence: { status: "SUFFICIENT" },
      human: "USEFUL_CONTROL",
    });
    expect(d.decision).toBe("RECOMMEND_CANDIDATE");
    expect(
      new OpportunityIntelligenceEngine().evaluate({
        candidate,
        suitability: suit,
        feasibility: feasible,
        process,
        data,
        risk,
        evidence: { status: "SUFFICIENT" },
        human: "USEFUL_CONTROL",
      }),
    ).toEqual(d);
  });
  it("hard gates unknown capabilities", () =>
    expect(
      new OpportunityDecisionEngine().decide({
        suitability: suit,
        feasibility: { ...feasible, status: "UNKNOWN" },
        process,
        data,
        risk,
        evidence: { status: "SUFFICIENT" },
        human: "USEFUL_CONTROL",
        candidateType: "AUTOMATION",
        value: 1,
      }).decision,
    ).toBe("NEED_MORE_EVIDENCE"));
  it("preserves mandatory human control", () =>
    expect(
      new OpportunityDecisionEngine().decide({
        suitability: suit,
        feasibility: feasible,
        process,
        data,
        risk,
        evidence: { status: "SUFFICIENT" },
        human: "MANDATORY_CONTROL",
        candidateType: "AUTOMATION",
        value: 1,
      }).decision,
    ).toBe("HUMAN_ASSISTED"));
  it("does not recommend low-value work", () =>
    expect(
      new OpportunityDecisionEngine().decide({
        suitability: suit,
        feasibility: feasible,
        process,
        data,
        risk,
        evidence: { status: "SUFFICIENT" },
        human: "USEFUL_CONTROL",
        candidateType: "AUTOMATION",
        value: 0.01,
      }).decision,
    ).toBe("REJECT"));
  it("blocks insufficient evidence and bad data", () => {
    expect(
      new OpportunityDecisionEngine().decide({
        suitability: suit,
        feasibility: feasible,
        process,
        data: { ...data, status: "NOT_READY" },
        risk,
        evidence: { status: "INSUFFICIENT" },
        human: "USEFUL_CONTROL",
        candidateType: "AUTOMATION",
        value: 1,
      }).decision,
    ).toBe("NEED_MORE_EVIDENCE");
  });
  it("separates AI suitability from automation", () => {
    const ai = new AISuitabilityAssessment().assess({
      unstructuredText: true,
      classification: true,
      extraction: true,
      semanticMatching: true,
      summarization: true,
      financialConsequence: 1,
      legalConsequence: 1,
      safetyConsequence: 0,
      explainabilityTolerance: 0.2,
      validationPath: 0,
      hallucinationSensitivity: 1,
    });
    expect(ai.status).toBe("AI_UNSUITABLE");
  });
});
