import { describe, expect, it } from "vitest";

import { AutomationSpecificationEngine } from "../automation-specifications/domain/automation-specification-engine";
import type {
  PublishedBlueprint,
  SpecificationRule,
} from "../automation-specifications/domain/automation-specification";
import {
  AutomationCandidateQualifier,
  AutomationSpecificationDraftBuilder,
  AutomationSpecificationDraftReviewService,
  ExistingAutomationSpecificationAdapter,
  SpecificationDraftReadinessValidator,
  type CandidateSpecificationKnowledge,
} from "./application/automation-candidate-specification-bridge";
import type { AutomationCandidate } from "./domain/work-intelligence";

const blueprint: PublishedBlueprint = {
  id: "blueprint-1",
  organizationId: "tenant-1",
  versionNumber: 1,
  status: "published",
  name: "Approved solution",
  objective: "Move information between validated business systems",
  components: [{ code: "PROCESS_INFORMATION", name: "Process information" }],
  capabilities: [{ code: "capability.process_information", name: "Process information" }],
  connectors: [],
  constraints: [],
  inputs: ["source-record"],
  outputs: ["processed-record"],
  topology: [],
};

const rules: SpecificationRule[] = [
  {
    id: "rule-transform",
    code: "PROJECT_STEPS",
    version: 1,
    ruleType: "transformation",
    decision: "project_steps",
    description: "Project approved components",
    published: true,
  },
  {
    id: "rule-validate",
    code: "ELEMENTS_PRESENT",
    version: 1,
    ruleType: "validation",
    operator: "elements_present",
    severity: "error",
    description: "Elements are required",
    published: true,
  },
];

function candidate(overrides: Partial<AutomationCandidate> = {}): AutomationCandidate {
  return {
    candidateId: "candidate-1",
    tenantId: "tenant-1",
    companyId: "company-1",
    sourceOpportunityId: "opportunity-1",
    sourcePatternIds: ["pattern-1"],
    supportingObservationIds: ["observation-1", "observation-2", "observation-3"],
    score: 88,
    confidence: 91,
    automationLevel: "AUTONOMOUS",
    tools: ["source-system", "destination-system"],
    requiresHumanApproval: false,
    expectedBenefit: {
      currentTimePerWeekMinutes: 240,
      estimatedAutomatableTimeMinutes: 192,
      estimatedHumanTimeRemainingMinutes: 48,
      financialRoi: "UNAVAILABLE",
    },
    riskClassification: "LOW",
    explanation: "Repeated predictable digital work",
    provenance: ["work-activity:1", "work-pattern:1", "automation-opportunity:1"],
    ...overrides,
  };
}

function knowledge(
  overrides: Partial<CandidateSpecificationKnowledge> = {},
): CandidateSpecificationKnowledge {
  return {
    normalizedPattern: "PROCESS_INFORMATION",
    objective: "Process a validated digital record",
    trigger: "validated-source-record-received",
    inputs: ["source-record"],
    outputs: ["processed-record"],
    systems: ["source-system", "destination-system"],
    capabilities: ["RECEIVE_INPUT", "LOOKUP_CONTEXT", "TRANSFORM_DATA", "WRITE_OUTPUT"],
    processSteps: [
      {
        stepId: "receive-input",
        kind: "READ_INPUT",
        requiredCapability: "RECEIVE_INPUT",
        knownInputs: ["source-record"],
        knownOutputs: ["validated-record"],
        confidence: 95,
        provenance: ["observation-1", "observation-2"],
      },
      {
        stepId: "write-output",
        kind: "ACTION",
        requiredCapability: "WRITE_OUTPUT",
        knownInputs: ["validated-record"],
        knownOutputs: ["processed-record"],
        confidence: 90,
        provenance: ["observation-3"],
      },
    ],
    businessRules: ["Only validated records are processed"],
    errorPolicy: "Route failed records to human review",
    approvalPolicy: null,
    provenance: ["audit:published:1"],
    solutionBlueprint: blueprint,
    ...overrides,
  };
}

describe("AutomationCandidate qualification", () => {
  it("qualifies complete evidence independently from automation score", () => {
    expect(new AutomationCandidateQualifier().qualify(candidate(), knowledge()).status).toBe(
      "READY_FOR_DRAFT",
    );
  });

  it("blocks a high-scoring candidate when trigger is unknown", () => {
    const result = new AutomationCandidateQualifier().qualify(
      candidate({ score: 99 }),
      knowledge({ trigger: null }),
    );
    expect(result.status).toBe("NEEDS_INFORMATION");
    expect(result.gaps.map((gap) => gap.code)).toContain("TRIGGER_UNKNOWN");
  });

  it("marks insufficient observations as not ready", () => {
    const result = new AutomationCandidateQualifier().qualify(
      candidate({ supportingObservationIds: ["observation-1"] }),
      knowledge(),
    );
    expect(result.status).toBe("NOT_READY");
  });

  it.each([
    ["inputs", [], "INPUT_SCHEMA_UNKNOWN"],
    ["outputs", [], "OUTPUT_UNKNOWN"],
    ["systems", [], "SYSTEM_MAPPING_UNKNOWN"],
    ["processSteps", [], "BUSINESS_RULE_UNKNOWN"],
  ] as const)("reports an explicit gap for %s", (field, value, gap) => {
    const result = new AutomationCandidateQualifier().qualify(
      candidate(),
      knowledge({ [field]: value }),
    );
    expect(result.gaps.map((item) => item.code)).toContain(gap);
  });

  it("requires a real published Solution Blueprint", () => {
    const result = new AutomationCandidateQualifier().qualify(
      candidate(),
      knowledge({ solutionBlueprint: null }),
    );
    expect(result.gaps.map((gap) => gap.code)).toContain("SOLUTION_BLUEPRINT_REQUIRED");
  });
});

describe("Automation Specification Draft", () => {
  const builder = new AutomationSpecificationDraftBuilder();

  it("keeps unknown trigger unknown without fallback", () => {
    const draft = builder.build(candidate(), knowledge({ trigger: null }));
    expect(draft.trigger).toBeNull();
    expect(draft.gaps.map((gap) => gap.code)).toContain("TRIGGER_UNKNOWN");
  });

  it("uses capability intentions instead of provider nodes", () => {
    const draft = builder.build(candidate(), knowledge());
    expect(draft.processSkeleton.steps.map((step) => step.requiredCapability)).toEqual([
      "RECEIVE_INPUT",
      "WRITE_OUTPUT",
    ]);
    expect(JSON.stringify(draft.processSkeleton)).not.toMatch(/gmail|shopify|salesforce/i);
  });

  it("preserves the complete Work Intelligence provenance chain", () => {
    const draft = builder.build(candidate(), knowledge());
    expect(draft.provenance).toEqual(
      expect.arrayContaining([
        "work-activity:1",
        "work-pattern:1",
        "automation-opportunity:1",
        "candidate-1",
        "audit:published:1",
        "observation-1",
      ]),
    );
  });

  it("preserves human approval and automation level", () => {
    const approvalCandidate = candidate({
      automationLevel: "AUTOMATION_WITH_APPROVAL",
      requiresHumanApproval: true,
    });
    const draft = builder.build(approvalCandidate, knowledge({ approvalPolicy: "Named reviewer" }));
    expect(draft.constraints).toContain("HUMAN_APPROVAL_REQUIRED");
    expect(draft.candidate.automationLevel).toBe("AUTOMATION_WITH_APPROVAL");
    expect(new SpecificationDraftReadinessValidator().validate(draft).blockingGaps).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "HUMAN_REVIEW_REQUIRED" })]),
    );
    expect(() => new ExistingAutomationSpecificationAdapter().adapt(draft, rules)).toThrow(
      "blocked",
    );
    const reviewed = new AutomationSpecificationDraftReviewService().review(draft, {
      decision: "ACCEPT",
      reviewerId: "authorized-reviewer",
    });
    expect(new SpecificationDraftReadinessValidator().validate(reviewed).status).toBe("READY");
    expect(
      new ExistingAutomationSpecificationAdapter().adapt(reviewed, rules).input.blueprint.id,
    ).toBe("blueprint-1");
  });

  it("rejects HUMAN_ONLY input", () => {
    expect(() => builder.build(candidate({ automationLevel: "HUMAN_ONLY" }), knowledge())).toThrow(
      "HUMAN_ONLY",
    );
  });

  it("creates immutable drafts and skeletons", () => {
    const draft = builder.build(candidate(), knowledge());
    expect(Object.isFrozen(draft)).toBe(true);
    expect(Object.isFrozen(draft.processSkeleton.steps)).toBe(true);
  });
});

describe("human review and readiness", () => {
  it("blocks acceptance while gaps remain", () => {
    const draft = new AutomationSpecificationDraftBuilder().build(
      candidate(),
      knowledge({ trigger: null }),
    );
    expect(new SpecificationDraftReadinessValidator().validate(draft).status).toBe(
      "BLOCKED_BY_GAPS",
    );
    expect(() =>
      new AutomationSpecificationDraftReviewService().review(draft, {
        decision: "ACCEPT",
        reviewerId: "reviewer-1",
      }),
    ).toThrow("Blocked");
  });

  it("makes supplied human knowledge authoritative in the next version", () => {
    const draft = new AutomationSpecificationDraftBuilder().build(
      candidate(),
      knowledge({ trigger: null }),
    );
    const corrected = new AutomationSpecificationDraftReviewService().review(draft, {
      decision: "SUPPLY_MISSING_INFORMATION",
      reviewerId: "reviewer-1",
      knowledge: { trigger: "approved-trigger" },
    });
    expect(corrected).toMatchObject({ version: 2, trigger: "approved-trigger" });
    expect(corrected.provenance).toContain("human-review:reviewer-1:SUPPLY_MISSING_INFORMATION");
    expect(new SpecificationDraftReadinessValidator().validate(corrected).status).toBe("READY");
  });

  it("records rejection without mutating the prior draft", () => {
    const draft = new AutomationSpecificationDraftBuilder().build(candidate(), knowledge());
    const rejected = new AutomationSpecificationDraftReviewService().review(draft, {
      decision: "REJECT",
      reviewerId: "reviewer-1",
    });
    expect(rejected).toMatchObject({ version: 2, status: "REJECTED" });
    expect(draft.status).toBe("DRAFT");
  });
});

describe("existing Automation Specification Engine adapter", () => {
  it("hands a ready draft to the existing engine without a second engine", () => {
    const draft = new AutomationSpecificationDraftBuilder().build(candidate(), knowledge());
    const handoff = new ExistingAutomationSpecificationAdapter().adapt(draft, rules);
    const result = new AutomationSpecificationEngine().generate(handoff.input);
    expect(result.elements).toHaveLength(1);
    expect(handoff.provenance).toContain("work-activity:1");
  });

  it("rejects cross-tenant blueprints", () => {
    const draft = new AutomationSpecificationDraftBuilder().build(
      candidate(),
      knowledge({ solutionBlueprint: { ...blueprint, organizationId: "tenant-2" } }),
    );
    expect(() => new ExistingAutomationSpecificationAdapter().adapt(draft, rules)).toThrow(
      "another tenant",
    );
  });

  it("rejects unpublished or incomplete catalogs", () => {
    const draft = new AutomationSpecificationDraftBuilder().build(candidate(), knowledge());
    expect(() => new ExistingAutomationSpecificationAdapter().adapt(draft, [])).toThrow(
      "transformation rules",
    );
  });

  it.each(["commerce", "hospitality", "professional-services"])(
    "uses the same bridge for the %s fixture",
    (sector) => {
      const draft = new AutomationSpecificationDraftBuilder().build(
        candidate({ candidateId: `candidate-${sector}` }),
        knowledge({ normalizedPattern: `GENERIC_PATTERN_${sector.toUpperCase()}` }),
      );
      expect(
        new ExistingAutomationSpecificationAdapter().adapt(draft, rules).input.blueprint.id,
      ).toBe("blueprint-1");
    },
  );
});
