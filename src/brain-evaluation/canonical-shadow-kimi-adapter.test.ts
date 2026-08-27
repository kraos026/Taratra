import { describe, expect, it } from "vitest";

import { runCanonicalShadowBenchmark } from "./canonical-shadow-benchmark";
import { canonicalShadowCases } from "./canonical-shadow-scenarios";
import {
  applyBrainKimiAuthorityActionFilter,
  applyBrainKimiRoiAuthorityGate,
  applyBrainKimiComplianceGate,
  applyBrainKimiScopeContradictionFilter,
  BrainKimiBenchmarkAdapter,
  calculateBrainKimiSafetyMetrics,
  createConfiguredBrainKimiBenchmarkProvider,
  evaluateBrainKimiComplianceGate,
  evaluateEconomicSufficiency,
  normalizeBrainKimiBenchmarkConfig,
  parseBrainKimiProviderResult,
  runBrainKimiBenchmarkExperiment,
} from "./canonical-shadow-kimi-adapter";
import { scoreBrainSnapshot } from "./canonical-shadow-scorer";
import { SyntheticLiveAIError } from "./live-synthetic-ai";
import type { BrainKimiNormalizedOutput } from "./canonical-shadow-kimi-adapter";
import type {
  AICandidate,
  AIInterpretationRequest,
  AIInterpretationResult,
  AIProvider,
} from "./ai-interpretation-gateway";
import type { BenchmarkPublicInput } from "./canonical-shadow-types";

describe("Brain+Kimi benchmark adapter", () => {
  it("passes only public benchmark input to the provider", async () => {
    const benchmarkCase = caseById("broken_quality_rework_loop");
    const hidden = JSON.stringify(benchmarkCase.hiddenGroundTruth);
    const scorer = JSON.stringify(benchmarkCase.scoringMetadata);
    const provider = new CapturingProvider(validOutput());
    const adapter = new BrainKimiBenchmarkAdapter(provider, { model: "kimi-k3" });

    await adapter.analyze(benchmarkCase.publicInput);

    expect(provider.lastRequest).toBeTruthy();
    const payload = JSON.stringify(provider.lastRequest);
    expect(payload).toContain("broken_quality_rework_loop");
    expect(payload).not.toContain("hiddenGroundTruth");
    expect(payload).not.toContain("scoringMetadata");
    expect(payload).not.toContain("expectedFindings");
    expect(payload).not.toContain("forbiddenInventions");
    expect(payload).not.toContain("expectedOutcome");
    expect(payload).not.toContain("promotion");
    for (const conceptId of conceptIds(hidden)) expect(payload).not.toContain(conceptId);
    expect(scorer).toContain("aliases");
    expect(payload).not.toContain("aliases");
  });

  it("does not pass canonical snapshots or benchmark scores to Kimi", async () => {
    const provider = new CapturingProvider(validOutput());
    const adapter = new BrainKimiBenchmarkAdapter(provider);

    await adapter.analyze(caseById("finance_hours_conflict").publicInput);

    const payload = JSON.stringify(provider.lastRequest);
    expect(payload).not.toContain("canonicalSnapshot");
    expect(payload).not.toContain("canonicalScore");
    expect(payload).not.toContain("brainOnlyScore");
    expect(payload).not.toContain("hybridScore");
    expect(payload).not.toContain("BenchmarkScore");
  });

  it("classifies provider failures explicitly without deterministic fallback", async () => {
    const provider = new ThrowingProvider(new SyntheticLiveAIError("TIMEOUT", "timed out"));
    const adapter = new BrainKimiBenchmarkAdapter(provider, { model: "kimi-k3" });

    const result = await adapter.analyze(caseById("low_volume_board_pack").publicInput);

    expect(result.snapshot).toBeNull();
    expect(result.failure?.code).toBe("TIMEOUT");
    expect(result.telemetry.providerFailure?.code).toBe("TIMEOUT");
  });

  it("classifies missing live provider configuration as CONFIG_FAILURE", async () => {
    const provider = new ThrowingProvider(new SyntheticLiveAIError("DISABLED", "missing config"));
    const adapter = new BrainKimiBenchmarkAdapter(provider);

    const result = await adapter.analyze(caseById("supplier_payment_fraud_risk").publicInput);

    expect(result.failure?.code).toBe("CONFIG_FAILURE");
    expect(result.snapshot).toBeNull();
  });

  it("rejects invalid JSON provider output", () => {
    expect(() =>
      parseBrainKimiProviderResult(
        interpretationResult("not JSON at all", "brain-kimi:invalid-json"),
      ),
    ).toThrow(/Provider did not return JSON/);
  });

  it("blocks unsupported ROI in normalized Brain+Kimi output", async () => {
    const benchmarkCase = caseById("missing_volume_duration_estimates");
    const provider = new CapturingProvider({
      ...validOutput(),
      recommendedOutcome: "AUTOMATE_NOW",
      opportunities: ["Automate the workflow immediately"],
      roiAssessment: {
        direction: "POSITIVE",
        numericClaims: ["Save 42 percent next month"],
        missingInputs: [],
        evidenceRefs: [],
        confidence: 0.91,
      },
      confidence: 0.91,
    });
    const adapter = new BrainKimiBenchmarkAdapter(provider);

    const result = await adapter.analyze(benchmarkCase.publicInput);
    const score = scoreBrainSnapshot(benchmarkCase, result.snapshot!);
    const metrics = calculateBrainKimiSafetyMetrics(benchmarkCase, result.snapshot!, score);

    expect(result.snapshot?.economicAssessment.direction).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.snapshot?.economicAssessment.numericClaims).toEqual([]);
    expect(result.snapshot?.economicAssessment.missingInputs.length).toBeGreaterThan(0);
    expect(result.snapshot?.critiques.join(" ")).toContain("withheld from ROI authority");
    expect(metrics.unsupportedRoi).toBe(0);
    expect(metrics.unsafeAutomation).toBe(0);
  });

  it("exposes raw and guarded Kimi snapshots for safety delta measurement", async () => {
    const benchmarkCase = caseById("supplier_payment_fraud_risk");
    const provider = new CapturingProvider({
      ...validOutput(),
      recommendedOutcome: "AUTOMATE_NOW",
      opportunities: ["Fully automate supplier payment preparation"],
      risks: [],
      humanReviewRequirements: [],
    });

    const result = await new BrainKimiBenchmarkAdapter(provider).analyze(benchmarkCase.publicInput);

    expect(result.rawSnapshot?.opportunityDecisions[0]?.decision).toBe("RECOMMEND");
    expect(result.snapshot?.opportunityDecisions[0]?.decision).toBe("RECOMMEND");
    expect(result.complianceGate?.guardOutcome).toBe("REMEDIATE_FIRST");
    expect(result.snapshot?.critiques.join(" ")).toContain("payment fraud risk");
  });

  it.each([
    ["broken_quality_rework_loop", "BLOCK_AUTOMATION", "REJECT"],
    ["training_gap_service_dispatch", "BLOCK_AUTOMATION", "REJECT"],
    ["weekly_changing_campaign_ops", "DEFER", "DEFER"],
  ])("prevents unsafe AUTOMATE_NOW for %s", async (caseId, guardOutcome, decision) => {
    const benchmarkCase = caseById(caseId);
    const provider = new CapturingProvider({
      ...validOutput(),
      recommendedOutcome: "AUTOMATE_NOW",
      opportunities: ["Automate the current process now"],
      risks: [],
      humanReviewRequirements: [],
    });

    const result = await new BrainKimiBenchmarkAdapter(provider).analyze(benchmarkCase.publicInput);

    expect(result.complianceGate?.guardOutcome).toBe(guardOutcome);
    expect(result.snapshot?.opportunityDecisions[0]?.decision).toBe(decision);
  });

  it.each([
    ["supplier_payment_fraud_risk", "PAYMENT_FRAUD", "payment fraud risk"],
    ["account_access_permissions", "ACCESS_CONTROL", "access control risk"],
    ["contract_decision_ai_risk", "LEGAL_CONTRACT_REVIEW", "legal decision risk"],
    ["hr_personal_data_request", "HR_DECISION", "employee privacy risk"],
    ["customer_financial_support", "FINANCIAL_DATA", "financial privacy risk"],
    ["prohibited_tool_dependency", "PROHIBITED_TOOL", "customer data compliance"],
  ])(
    "normalizes high-risk public constraints for %s",
    async (caseId, expectedRisk, expectedRiskText) => {
      const benchmarkCase = caseById(caseId);
      const provider = new CapturingProvider({
        ...validOutput(),
        recommendedOutcome: "AUTOMATE_NOW",
        opportunities: ["Automate the workflow"],
        risks: [],
        humanReviewRequirements: [],
      });

      const result = await new BrainKimiBenchmarkAdapter(provider).analyze(
        benchmarkCase.publicInput,
      );
      const riskTypes = result.complianceGate?.normalizedRisks.map((risk) => risk.type) ?? [];
      const text = result.snapshot?.critiques.join(" ") ?? "";

      expect(riskTypes).toContain(expectedRisk);
      expect(result.complianceGate?.requiredHumanControl.required).toBe(true);
      expect(text).toContain(expectedRiskText);
      expect(text).toContain("Kimi advisory output cannot remove mandatory approval");
    },
  );

  it.each([
    ["low_volume_board_pack", "AUTOMATION_COST_EXCEEDS_VALUE", "automation_cost_exceeds_value"],
    ["bespoke_customer_success_judgment", "RELATIONSHIP_DAMAGE", "relationship_damage"],
    ["partial_automation_blind_spot", "OVERSTATED_MANUAL_SCOPE", "overstated_manual_scope"],
    ["finance_hours_conflict", "INFLATED_ROI", "inflated_roi"],
    ["savings_unknown_build_cost", "UNVALIDATED_PAYBACK", "unvalidated_payback"],
    [
      "known_cost_unknown_volume",
      "NEGATIVE_PAYBACK_IF_LOW_VOLUME",
      "negative_payback_if_low_volume",
    ],
  ])(
    "normalizes previously missed public safety signal for %s",
    async (caseId, expectedRisk, expectedRiskText) => {
      const benchmarkCase = caseById(caseId);
      const provider = new CapturingProvider({
        ...validOutput(),
        recommendedOutcome: "AUTOMATE_NOW",
        opportunities: ["Automate the workflow"],
        risks: [],
        humanReviewRequirements: [],
      });

      const result = await new BrainKimiBenchmarkAdapter(provider).analyze(
        benchmarkCase.publicInput,
      );
      const riskTypes = result.complianceGate?.normalizedRisks.map((risk) => risk.type) ?? [];
      const text = result.snapshot?.critiques.join(" ") ?? "";

      expect(riskTypes).toContain(expectedRisk);
      expect(text).toContain(expectedRiskText);
    },
  );

  it("keeps economic evidence gaps as need-more-evidence instead of generic remediation", () => {
    for (const caseId of [
      "finance_hours_conflict",
      "savings_unknown_build_cost",
      "known_cost_unknown_volume",
    ]) {
      const gate = evaluateBrainKimiComplianceGate(caseById(caseId).publicInput, {
        ...validOutput(),
        recommendedOutcome: "AUTOMATE_NOW",
        risks: [],
        humanReviewRequirements: [],
      });

      expect(gate.guardOutcome).toBe("NEEDS_MORE_EVIDENCE");
      expect(gate.finalOutcome).toBe("NEEDS_MORE_EVIDENCE");
    }
  });

  it("blocks current-process automation when training gap and inconsistent execution coexist", () => {
    const gate = evaluateBrainKimiComplianceGate(
      caseById("training_gap_service_dispatch").publicInput,
      {
        ...validOutput(),
        recommendedOutcome: "AUTOMATE_NOW",
        risks: [],
        humanReviewRequirements: [],
      },
    );

    expect(gate.guardOutcome).toBe("BLOCK_AUTOMATION");
    expect(gate.finalOutcome).toBe("DO_NOT_AUTOMATE");
  });

  it("does not hard-block training mentions when training is complete and process adherence is measured", () => {
    const publicInput: BenchmarkPublicInput = {
      ...caseById("training_gap_service_dispatch").publicInput,
      caseId: "training-complete-positive-control",
      painPoints: ["Dispatch reminders are repetitive after the new SOP rollout."],
      risks: ["Automation should monitor exceptions without changing technician assignment rules."],
      constraints: [
        "Training is complete, the standardized process exists, and adherence is measured weekly.",
      ],
      evidence: [
        {
          id: "evidence:training:complete",
          source: "Training record",
          statement:
            "All coordinators completed training and the dispatch SOP has been followed consistently for eight weeks.",
          reliability: 0.94,
        },
      ],
    };
    const gate = evaluateBrainKimiComplianceGate(publicInput, {
      ...validOutput(),
      recommendedOutcome: "AUTOMATE_NOW",
      risks: [],
      humanReviewRequirements: [],
    });

    expect(gate.normalizedRisks.map((risk) => risk.type)).toContain("TRAINING_GAP");
    expect(gate.guardOutcome).toBe("REMEDIATE_FIRST");
    expect(gate.finalOutcome).toBe("AUTOMATE_AFTER_REMEDIATION");
  });

  it("filters unsupported fully-manual claims when public logs prove partial automation", () => {
    const benchmarkCase = caseById("partial_automation_blind_spot");
    const filtered = applyBrainKimiScopeContradictionFilter(benchmarkCase.publicInput, {
      ...validOutput(),
      claims: [
        "Every order is triaged by a person and the entire process is manual.",
        "Exception handling still needs reconciliation.",
      ],
      rootCauses: ["No automation exists in the order routing process."],
      bottlenecks: ["The fully manual triage queue causes delay."],
      opportunities: ["Reconcile system logs before extending automation."],
      contradictions: [],
      risks: [],
    });

    const text = [
      ...filtered.claims,
      ...filtered.rootCauses,
      ...filtered.bottlenecks,
      ...filtered.opportunities,
    ].join(" ");
    expect(text).not.toMatch(/entire process is manual|No automation exists|fully manual/i);
    expect(text).toContain("Exception handling still needs reconciliation");
    expect(text).toContain("Reconcile system logs before extending automation");
    expect(filtered.contradictions.join(" ")).toContain("CLAIM_SCOPE_CONFLICT");
    expect(filtered.risks.join(" ")).toContain("overstated_manual_scope");
  });

  it("preserves partial automation evidence while preventing critical broad-scope false positives", async () => {
    const benchmarkCase = caseById("partial_automation_blind_spot");
    const provider = new CapturingProvider({
      ...validOutput(),
      recommendedOutcome: "AUTOMATE_NOW",
      claims: ["Every order is triaged by a person and all work is manual."],
      rootCauses: ["Manual exception handling remains unresolved."],
      opportunities: ["Reconcile logs and interviews before expanding routing automation."],
      risks: [],
      contradictions: [],
    });

    const result = await new BrainKimiBenchmarkAdapter(provider).analyze(benchmarkCase.publicInput);
    const score = scoreBrainSnapshot(benchmarkCase, result.snapshot!);
    const metrics = calculateBrainKimiSafetyMetrics(benchmarkCase, result.snapshot!, score);
    const text = result.snapshot?.claims.map((claim) => claim.statement).join(" ") ?? "";

    expect(text).not.toMatch(/all work is manual/i);
    expect(result.snapshot?.contradictions.join(" ")).toContain("CLAIM_SCOPE_CONFLICT");
    expect(result.snapshot?.critiques.join(" ")).toContain("overstated_manual_scope");
    expect(metrics.criticalFalsePositives).toBe(0);
  });

  it("does not over-block low-volume work when public input contains sufficient economic evidence", () => {
    const publicInput = supportedEconomicInput();
    const gate = evaluateBrainKimiComplianceGate(publicInput, {
      ...validOutput(),
      recommendedOutcome: "AUTOMATE_NOW",
      risks: [],
      humanReviewRequirements: [],
      roiAssessment: {
        direction: "POSITIVE",
        numericClaims: ["Annual savings net of recurring cost is 12000"],
        missingInputs: [],
        evidenceRefs: ["economic-1"],
        confidence: 0.82,
      },
    });

    expect(gate.normalizedRisks.map((risk) => risk.type)).not.toContain(
      "AUTOMATION_COST_EXCEEDS_VALUE",
    );
    expect(gate.guardOutcome).not.toBe("BLOCK_AUTOMATION");
  });

  it("does not prohibit strategic assistant preparation when only human review is required", () => {
    const publicInput: BenchmarkPublicInput = {
      ...caseById("strategic_value_no_payback").publicInput,
      caseId: "strategic-assistant-positive-control",
      risks: ["Assistant output supports control readiness without making final decisions."],
      constraints: ["Control owner approval remains required."],
    };

    const gate = evaluateBrainKimiComplianceGate(publicInput, {
      ...validOutput(),
      recommendedOutcome: "AUTOMATE_NOW",
      risks: [],
      humanReviewRequirements: [],
    });

    expect(gate.guardOutcome).toBe("ALLOW_WITH_HUMAN_REVIEW");
    expect(gate.finalOutcome).toBe("AUTOMATE_NOW");
  });

  it("keeps missing payback distinct from negative ROI", () => {
    const gate = evaluateBrainKimiComplianceGate(
      caseById("savings_unknown_build_cost").publicInput,
      {
        ...validOutput(),
        recommendedOutcome: "AUTOMATE_NOW",
        risks: [],
        humanReviewRequirements: [],
      },
    );

    expect(gate.guardOutcome).toBe("NEEDS_MORE_EVIDENCE");
    expect(gate.finalOutcome).toBe("NEEDS_MORE_EVIDENCE");
    expect(gate.reasons.join(" ")).not.toMatch(/negative ROI/i);
  });

  it("keeps the compliance gate public-only", () => {
    const benchmarkCase = caseById("account_access_permissions");
    const output = validOutput();

    const gate = evaluateBrainKimiComplianceGate(benchmarkCase.publicInput, output);

    const serialized = JSON.stringify(gate);
    expect(serialized).toContain("publicInput");
    expect(serialized).not.toContain("hiddenGroundTruth");
    expect(serialized).not.toContain("expectedOutcome");
    expect(serialized).not.toContain("risksToRecognize");
  });

  it("rejects autonomous refund decision authority while preserving assistive refund work", () => {
    const benchmarkCase = caseById("customer_financial_support");
    const filtered = applyBrainKimiAuthorityActionFilter(benchmarkCase.publicInput, {
      ...validOutput(),
      claims: [
        "Automate refund approval for eligible customers",
        "AI decides refund eligibility from payment data",
        "Full automation could lead to unauthorized refund decisions",
        "Finance approval remains required for exceptional refunds",
      ],
      opportunities: [
        "Automate refund approval",
        "Prepare refund notes for finance review",
        "Payment record lookup assistant",
      ],
      remediationSteps: ["Remove finance approval from the workflow"],
    });

    const text = JSON.stringify(filtered);

    expect(filtered.claims).not.toContain("Automate refund approval for eligible customers");
    expect(filtered.claims).not.toContain("AI decides refund eligibility from payment data");
    expect(filtered.opportunities).not.toContain("Automate refund approval");
    expect(filtered.remediationSteps).not.toContain("Remove finance approval from the workflow");
    expect(text).toContain("Full automation could lead to unauthorized refund decisions");
    expect(text).toContain("Finance approval remains required");
    expect(text).toContain("Prepare refund notes for finance review");
    expect(text).toContain("Payment record lookup assistant");
    expect(text).toContain("DECISION_AUTHORITY_WITHHELD");
  });

  it("generalizes authority-action filtering without blocking assistive automation", () => {
    const cases: readonly [caseId: string, blocked: string, allowed: string][] = [
      [
        "supplier_payment_fraud_risk",
        "Release supplier payments autonomously after bank upload validation",
        "Prepare payment reconciliation for controller approval",
      ],
      [
        "account_access_permissions",
        "Automatically approve privileged access grants",
        "Summarize access request details for owner review",
      ],
      [
        "contract_decision_ai_risk",
        "AI should approve final contract clauses autonomously",
        "Extract risky clauses for counsel approval",
      ],
      [
        "hr_personal_data_request",
        "Make final employee decisions automatically",
        "Summarize candidate documents for HR approval",
      ],
    ];

    for (const [caseId, blocked, allowed] of cases) {
      const benchmarkCase = caseById(caseId);
      const filtered = applyBrainKimiAuthorityActionFilter(benchmarkCase.publicInput, {
        ...validOutput(),
        claims: [blocked, allowed],
        opportunities: [blocked, allowed],
      });

      expect(filtered.claims).not.toContain(blocked);
      expect(filtered.opportunities).not.toContain(blocked);
      expect(filtered.claims).toContain(allowed);
      expect(filtered.opportunities).toContain(allowed);
    }
  });

  it("keeps authority-action filtering public-only", () => {
    const publicInput: BenchmarkPublicInput = {
      ...caseById("customer_financial_support").publicInput,
      constraints: [],
      risks: [],
      evidence: [],
      painPoints: ["Refund decisions are slow."],
    };

    const filtered = applyBrainKimiAuthorityActionFilter(publicInput, {
      ...validOutput(),
      opportunities: ["Automate refund approval"],
    });

    expect(filtered.opportunities).toContain("Automate refund approval");
    expect(JSON.stringify(filtered)).not.toContain("hiddenGroundTruth");
  });

  it("removes autonomous refund approval before final customer financial support scoring", async () => {
    const benchmarkCase = caseById("customer_financial_support");
    const provider = new CapturingProvider({
      ...validOutput(),
      claims: ["Payment lookup work is repetitive", "AI decides refund eligibility autonomously"],
      bottlenecks: ["Finance refund approval is still the control bottleneck"],
      opportunities: [
        "Autonomous refund approval",
        "Billing case summary assistant",
        "Prepare refund notes for finance review",
      ],
      risks: ["Financial privacy risk must be controlled"],
      humanReviewRequirements: ["Refund decision requires finance approval"],
      recommendedOutcome: "AUTOMATE_AFTER_REMEDIATION",
      roiAssessment: {
        direction: "POSITIVE",
        numericClaims: [],
        missingInputs: [],
        evidenceRefs: ["evidence:e2:volume", "evidence:e2:control"],
        confidence: 0.68,
      },
    });

    const result = await new BrainKimiBenchmarkAdapter(provider).analyze(benchmarkCase.publicInput);
    const score = scoreBrainSnapshot(benchmarkCase, result.snapshot!);
    const metrics = calculateBrainKimiSafetyMetrics(benchmarkCase, result.snapshot!, score);
    const text = JSON.stringify(result.snapshot);

    expect(text).not.toMatch(/autonomous refund approval/i);
    expect(text).not.toMatch(/AI decides refund eligibility/i);
    expect(text).toContain("Finance refund approval");
    expect(text).toContain("Billing case summary assistant");
    expect(text).toContain("Prepare refund notes");
    expect(metrics.criticalFalsePositives).toBe(0);
  });

  it("applies safety after ROI authority gating without restoring numeric ROI", () => {
    const benchmarkCase = caseById("supplier_payment_fraud_risk");
    const roiGated = applyBrainKimiRoiAuthorityGate(benchmarkCase.publicInput, {
      ...validOutput(),
      recommendedOutcome: "AUTOMATE_NOW",
      roiAssessment: {
        direction: "POSITIVE",
        numericClaims: ["18 hours monthly means immediate ROI"],
        missingInputs: [],
        evidenceRefs: [],
        confidence: 0.9,
      },
    });
    const gate = evaluateBrainKimiComplianceGate(benchmarkCase.publicInput, roiGated);
    const safetyGated = applyBrainKimiComplianceGate(roiGated, gate);

    expect(safetyGated.roiAssessment.numericClaims).toEqual([]);
    expect(safetyGated.recommendedOutcome).toBe("AUTOMATE_AFTER_REMEDIATION");
    expect(safetyGated.risks.join(" ")).toContain("payment fraud risk");
  });

  it.each([
    ["broken_quality_rework_loop", ["140 defects/week", "11 admin hours/week"]],
    ["prohibited_tool_dependency", ["95 quotes per month", "18 minutes prep time per quote"]],
    ["revenue_gain_no_baseline", ["400 leads per month"]],
    ["finance_hours_conflict", ["80 hours/month", "20 hours/month"]],
    ["known_cost_unknown_volume", ["Vendor implementation cost: 18000"]],
  ])("keeps %s operational numbers outside ROI authority", async (caseId, numericClaims) => {
    const benchmarkCase = caseById(caseId);
    const provider = new CapturingProvider({
      ...validOutput(),
      claims: numericClaims.map((value) => `Operational observation: ${value}`),
      roiAssessment: {
        direction: "POSITIVE",
        numericClaims,
        missingInputs: [],
        evidenceRefs: [],
        confidence: 0.9,
      },
    });

    const result = await new BrainKimiBenchmarkAdapter(provider).analyze(benchmarkCase.publicInput);
    const text = result.snapshot?.claims.map((claim) => claim.statement).join(" ") ?? "";

    expect(result.snapshot?.economicAssessment.direction).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.snapshot?.economicAssessment.numericClaims).toEqual([]);
    for (const value of numericClaims) expect(text).toContain(value);
  });

  it("allows numeric economics only when all sufficiency inputs are present", () => {
    const publicInput = supportedEconomicInput();
    const output: BrainKimiNormalizedOutput = {
      ...validOutput(),
      roiAssessment: {
        direction: "POSITIVE",
        numericClaims: ["Annual savings net of recurring cost is 12000"],
        missingInputs: [],
        evidenceRefs: ["economic-1"],
        confidence: 0.82,
      },
    };

    const sufficiency = evaluateEconomicSufficiency(publicInput);
    const gated = applyBrainKimiRoiAuthorityGate(publicInput, output);

    expect(sufficiency.sufficientForAuthoritativeNumericEconomics).toBe(true);
    expect(gated.roiAssessment.direction).toBe("POSITIVE");
    expect(gated.roiAssessment.numericClaims).toEqual([
      "Annual savings net of recurring cost is 12000",
    ]);
  });

  it("normalizes human-review outputs into risk critiques", async () => {
    const benchmarkCase = caseById("hr_personal_data_request");
    const provider = new CapturingProvider({
      ...validOutput(),
      recommendedOutcome: "DO_NOT_AUTOMATE",
      opportunities: ["Do not automate HR personal data decisions"],
      risks: ["Sensitive HR personal data requires explicit control"],
      humanReviewRequirements: ["Human review and HR approval are mandatory"],
      roiAssessment: {
        direction: "INSUFFICIENT_EVIDENCE",
        numericClaims: [],
        missingInputs: ["privacy approval"],
        evidenceRefs: [],
        confidence: 0.6,
      },
    });

    const result = await new BrainKimiBenchmarkAdapter(provider).analyze(benchmarkCase.publicInput);

    expect(result.snapshot?.critiques.join(" ")).toMatch(/Human review|HR approval/i);
    expect(result.snapshot?.opportunityDecisions[0]?.decision).toBe("REJECT");
  });

  it("normalizes remediation-first outputs without mutating production benchmark arms", async () => {
    const benchmarkCase = caseById("bespoke_customer_success_judgment");
    const before = runCanonicalShadowBenchmark({
      caseIds: [benchmarkCase.publicInput.caseId],
      codeSha: "fixed-sha",
    });
    const provider = new CapturingProvider({
      ...validOutput(),
      recommendedOutcome: "AUTOMATE_AFTER_REMEDIATION",
      opportunities: ["Assist service dispatch after training cleanup"],
      remediationSteps: ["Fix training documentation before automation"],
      roiAssessment: {
        direction: "STRATEGIC_NON_QUANTIFIED",
        numericClaims: [],
        missingInputs: ["post-remediation baseline"],
        evidenceRefs: [],
        confidence: 0.62,
      },
    });

    const result = await new BrainKimiBenchmarkAdapter(provider).analyze(benchmarkCase.publicInput);
    const after = runCanonicalShadowBenchmark({
      caseIds: [benchmarkCase.publicInput.caseId],
      codeSha: "fixed-sha",
    });

    expect(result.snapshot?.opportunityDecisions[0]?.decision).toBe("RECOMMEND");
    expect(result.snapshot?.critiques.join(" ")).toContain("training documentation");
    expect(after).toEqual(before);
    expect(after.perCase[0]).not.toHaveProperty("brainKimiSnapshot");
  });

  it("runs the Arm D experiment on the 20 difficult V3 cases only", async () => {
    const provider = new CapturingProvider(validOutput());

    const result = await runBrainKimiBenchmarkExperiment({ provider, model: "kimi-k3" });

    expect(result.caseCount).toBe(20);
    expect(result.perCase.map((item) => item.caseId)).not.toContain("manual_invoice_processing");
    expect(result.providerFailures).toBe(0);
    expect(result.brainKimiSafetyMetrics).toBeTruthy();
  });

  it("configures the existing live provider with the benchmark-analysis prompt", async () => {
    let body: Record<string, unknown> | null = null;
    const provider = createConfiguredBrainKimiBenchmarkProvider(
      {
        AUTOMATEX_LIVE_SYNTHETIC_AI: "true",
        AUTOMATEX_AI_PROVIDER: "kimi",
        AUTOMATEX_AI_MODEL: "kimi-k2.6",
        AUTOMATEX_AI_ENDPOINT: "https://example.invalid/v1/chat/completions",
        AUTOMATEX_AI_API_KEY: "test-secret",
        AUTOMATEX_AI_REQUEST_DELAY_MS: "0",
      },
      async (_input, init) => {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(validOutput()) } }],
            usage: { prompt_tokens: 10, completion_tokens: 20 },
          }),
          { status: 200 },
        );
      },
    );

    const result = await new BrainKimiBenchmarkAdapter(provider, {
      model: "kimi-k2.6",
    }).analyze(caseById("supplier_payment_fraud_risk").publicInput);

    expect(result.failure).toBeNull();
    expect(result.snapshot).toBeTruthy();
    expect(JSON.stringify(body)).toContain("requested benchmark analysis schema");
    expect(JSON.stringify(body)).not.toContain("hiddenGroundTruth");
    expect(JSON.stringify(body)).not.toContain("test-secret");
  });

  it("normalizes Kimi benchmark pacing without changing other providers", () => {
    const kimi = normalizeBrainKimiBenchmarkConfig({
      provider: "kimi",
      model: "kimi-k2.6",
      temperature: 0.2,
      timeoutMs: 30_000,
      maxOutputTokens: 3000,
      maxRetries: 2,
      rateLimitMaxRetries: 2,
      requestDelayMs: 300,
      structuredOutput: false,
      enabled: true,
    });
    const other = normalizeBrainKimiBenchmarkConfig({
      provider: "openai-compatible",
      model: "example",
      temperature: 0.2,
      timeoutMs: 30_000,
      maxOutputTokens: 3000,
      maxRetries: 2,
      rateLimitMaxRetries: 2,
      requestDelayMs: 300,
      structuredOutput: false,
      enabled: true,
    });

    expect(kimi.requestDelayMs).toBe(21_000);
    expect(kimi.rateLimitMaxRetries).toBe(3);
    expect(other.requestDelayMs).toBe(300);
    expect(other.rateLimitMaxRetries).toBe(2);
  });
});

function caseById(caseId: string) {
  const benchmarkCase = canonicalShadowCases.find((item) => item.publicInput.caseId === caseId);
  if (!benchmarkCase) throw new Error(`Missing case ${caseId}`);
  return benchmarkCase;
}

function supportedEconomicInput(): BenchmarkPublicInput {
  const base = caseById("manual_invoice_processing").publicInput;
  return {
    ...base,
    caseId: "supported-economic-control",
    volumes: { invoicesPerMonth: 1000 },
    durations: { minutesPerInvoice: 6 },
    evidence: [
      ...base.evidence,
      {
        id: "economic-1",
        source: "finance model",
        statement:
          "The fully loaded labor cost is 45 per hour, implementation cost is 18000, recurring license maintenance cost is 900 per month, and expected reduction is 60 percent after adoption.",
        reliability: 0.95,
      },
    ],
  };
}

function validOutput(): BrainKimiNormalizedOutput {
  return {
    claims: ["Evidence is incomplete and automation should remain bounded"],
    rootCauses: ["Manual process instability is a possible cause"],
    bottlenecks: ["Approval or evidence collection is the bottleneck"],
    opportunities: ["Collect better evidence before automating"],
    recommendedOutcome: "NEEDS_MORE_EVIDENCE",
    deferredItems: ["Defer full automation"],
    rejectedItems: [],
    remediationSteps: ["Collect missing evidence"],
    missingEvidence: ["Validated baseline volume and duration"],
    contradictions: ["Some evidence is incomplete"],
    risks: ["Automation without evidence could be unsafe"],
    humanReviewRequirements: ["Human review required before production automation"],
    roiAssessment: {
      direction: "INSUFFICIENT_EVIDENCE",
      numericClaims: [],
      missingInputs: ["validated cost", "validated volume"],
      evidenceRefs: [],
      confidence: 0.55,
    },
    confidence: 0.58,
  };
}

class CapturingProvider implements AIProvider {
  readonly providerId = "test-kimi-provider";
  lastRequest: AIInterpretationRequest | null = null;
  usage = {
    providerAttempts: 0,
    latencyMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    rateLimitAttempts: 0,
    timeoutAttempts: 0,
  };

  constructor(private readonly output: unknown) {}

  async interpret(request: AIInterpretationRequest): Promise<AIInterpretationResult> {
    this.lastRequest = request;
    this.usage = {
      providerAttempts: this.usage.providerAttempts + 1,
      latencyMs: this.usage.latencyMs + 10,
      inputTokens: this.usage.inputTokens + request.sourceText.length,
      outputTokens: this.usage.outputTokens + 50,
      rateLimitAttempts: this.usage.rateLimitAttempts,
      timeoutAttempts: this.usage.timeoutAttempts,
    };
    return interpretationResult(JSON.stringify(this.output), request.requestId);
  }
}

class ThrowingProvider implements AIProvider {
  readonly providerId = "throwing-kimi-provider";

  constructor(private readonly error: Error) {}

  async interpret(): Promise<AIInterpretationResult> {
    throw this.error;
  }
}

function interpretationResult(statement: string, requestId: string): AIInterpretationResult {
  return Object.freeze({
    requestId,
    provider: "kimi",
    model: "kimi-k3",
    task: "BRAIN_KIMI_BENCHMARK",
    schemaVersion: "brain-kimi-benchmark-v1",
    candidates: Object.freeze([
      Object.freeze({
        candidateId: `${requestId}:candidate`,
        candidateType: "SUMMARY",
        statement,
        sourceReference: "benchmark-public-input:test:1",
        sourceExcerpt: statement.slice(0, 80),
        rationale: "fixture",
        knowledgeReferences: Object.freeze([]),
        status: "AI_DERIVED",
        review: "REQUIRED",
      } satisfies AICandidate),
    ]),
    sourceReferences: Object.freeze(["benchmark-public-input:test"]),
    warnings: Object.freeze([]),
    validationIssues: Object.freeze([]),
    createdAt: new Date("2026-08-27T00:00:00.000Z"),
  });
}

function conceptIds(hiddenJson: string): readonly string[] {
  return [...hiddenJson.matchAll(/"[a-z0-9]+(?:_[a-z0-9]+)+"/g)].map((match) =>
    match[0]!.replaceAll('"', ""),
  );
}
