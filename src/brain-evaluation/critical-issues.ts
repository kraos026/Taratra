import type { CauseCandidate, Bottleneck } from "./process-causal";
import type { Contradiction, UnknownInformation } from "./brain-contracts";

export type CriticalIssueType =
  | "ROOT_CAUSE"
  | "BOTTLENECK"
  | "DATA_QUALITY"
  | "SINGLE_POINT_OF_FAILURE"
  | "MANDATORY_CONTROL_RISK"
  | "NEGATIVE_ECONOMICS"
  | "UNRESOLVED_CRITICAL_UNKNOWN"
  | "HIGH_RISK_AUTOMATION"
  | "OBSERVABILITY_GAP";
export type CriticalIssueSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export interface CriticalIssue {
  issueId: string;
  issueType: CriticalIssueType;
  subject: string;
  severity: CriticalIssueSeverity;
  evidence: readonly string[];
  reason: string;
  downstreamImpact: string;
  blockingDecision: boolean;
  confidence: number;
}

export class CriticalIssueDetector {
  detect(input: {
    causes: readonly CauseCandidate[];
    bottlenecks: readonly Bottleneck[];
    unknowns?: readonly UnknownInformation[];
    contradictions?: readonly Contradiction[];
    mandatoryControlSubjects?: readonly string[];
    negativeEconomics?: boolean;
    risks?: readonly { subject: string; severity: CriticalIssueSeverity }[];
  }): readonly CriticalIssue[] {
    const issues: CriticalIssue[] = [];
    for (const cause of input.causes.filter((cause) => cause.kind === "ROOT"))
      issues.push({
        issueId: `issue:root:${cause.causeId}`,
        issueType: "ROOT_CAUSE",
        subject: cause.semanticKey ?? cause.causeId,
        severity: "HIGH",
        evidence: cause.supportingEvidenceIds,
        reason: cause.statement,
        downstreamImpact: "May affect downstream decisions",
        blockingDecision: cause.confidence < 0.6,
        confidence: cause.confidence,
      });
    for (const bottleneck of input.bottlenecks.filter(
      (bottleneck) => (bottleneck.materiality ?? bottleneck.impact) >= 0.5,
    ))
      issues.push({
        issueId: `issue:bottleneck:${bottleneck.stepId}`,
        issueType: "BOTTLENECK",
        subject: bottleneck.semanticKey ?? bottleneck.stepId,
        severity: bottleneck.severity === "HIGH" ? "HIGH" : "MEDIUM",
        evidence: bottleneck.evidenceIds,
        reason: bottleneck.reason,
        downstreamImpact: "Delays or constrains process throughput",
        blockingDecision: (bottleneck.materiality ?? bottleneck.impact) >= 0.8,
        confidence: bottleneck.confidence,
      });
    for (const subject of input.mandatoryControlSubjects ?? [])
      issues.push({
        issueId: `issue:control:${subject}`,
        issueType: "MANDATORY_CONTROL_RISK",
        subject,
        severity: "HIGH",
        evidence: [],
        reason: "Mandatory human control requires preservation",
        downstreamImpact: "Automation decision must retain human control",
        blockingDecision: true,
        confidence: 0.9,
      });
    for (const unknown of (input.unknowns ?? []).filter(
      (unknown) => unknown.priority === "CRITICAL",
    ))
      issues.push({
        issueId: `issue:unknown:${unknown.unknownId}`,
        issueType: "UNRESOLVED_CRITICAL_UNKNOWN",
        subject: unknown.missingField,
        severity: "CRITICAL",
        evidence: [],
        reason: unknown.reason,
        downstreamImpact: unknown.impact,
        blockingDecision: true,
        confidence: 1 - 0.5,
      });
    if ((input.contradictions ?? []).length)
      issues.push({
        issueId: "issue:contradictions",
        issueType: "OBSERVABILITY_GAP",
        subject: "contradictory evidence",
        severity: "MEDIUM",
        evidence: [],
        reason: "Contradictory sources remain",
        downstreamImpact: "May require clarification",
        blockingDecision: false,
        confidence: 0.7,
      });
    if (input.negativeEconomics)
      issues.push({
        issueId: "issue:economics",
        issueType: "NEGATIVE_ECONOMICS",
        subject: "automation candidate",
        severity: "HIGH",
        evidence: [],
        reason: "Economic direction is negative",
        downstreamImpact: "Automation should not be recommended",
        blockingDecision: true,
        confidence: 0.9,
      });
    for (const risk of input.risks ?? [])
      issues.push({
        issueId: `issue:risk:${risk.subject}`,
        issueType: "HIGH_RISK_AUTOMATION",
        subject: risk.subject,
        severity: risk.severity,
        evidence: [],
        reason: "Risk requires review",
        downstreamImpact: "Decision risk",
        blockingDecision: risk.severity === "CRITICAL",
        confidence: 0.7,
      });
    return Object.freeze(issues.map((issue) => Object.freeze(issue)));
  }
}
