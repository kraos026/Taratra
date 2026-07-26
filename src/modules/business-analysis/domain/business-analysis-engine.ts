export type FindingSeverity = "critical" | "high" | "medium" | "low" | "information";

export interface AnalysisRule {
  id: string;
  code: string;
  version: number;
  title: string;
  description: string;
  severity: FindingSeverity;
  category: string;
  evaluationLogic: Record<string, unknown>;
  explanationTemplate: string;
  recommendationHint: string | null;
}

export interface AnalysisFact {
  id: string;
  key: string;
  domain: string;
  value: unknown;
  confidence: number;
}

export interface AnalysisNode {
  id: string;
  key: string;
  type: string;
  name: string;
  description: string | null;
  executionMode: string | null;
  durationMinutes: number | null;
  actorId: string | null;
  departmentId: string | null;
  systemId: string | null;
  factIds: string[];
}

export interface AnalysisInput {
  processMap: {
    id: string;
    name: string;
    status: string;
    completeness: number;
    confidence: number;
    coverage: number;
    ownerId: string | null;
    systemIds: string[];
    validationCodes: string[];
  };
  nodes: AnalysisNode[];
  facts: AnalysisFact[];
  rules: AnalysisRule[];
}

export interface DetectedFinding {
  identifier: string;
  rule: AnalysisRule;
  description: string;
  relatedStepId: string | null;
  relatedDepartmentId: string | null;
  relatedActorId: string | null;
  relatedSystemId: string | null;
  confidence: number;
  businessImpact: string;
  riskPoints: number;
  evidenceFactIds: string[];
  evidence: Record<string, unknown>;
}

export interface AnalysisScore {
  code: string;
  label: string;
  score: number;
  direction: "higher_is_better" | "higher_is_exposure";
  calculation: { formula: string; contributions: { finding: string; points: number }[] };
}

export interface AnalysisHealth {
  dimension: string;
  scopeType: "organization" | "department" | "process" | "system";
  scopeReferenceId: string | null;
  score: number;
  calculation: { formula: string; sourceScores: string[] };
}

const RISK_POINTS: Record<FindingSeverity, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
  information: 0,
};

export class BusinessAnalysisEngine {
  analyze(input: AnalysisInput) {
    const findings = this.detectFindings(input);
    const scores = this.calculateScores(findings);
    const health = this.calculateHealth(scores);
    return {
      findings,
      scores,
      health,
      risk: this.calculateRisk(findings),
      validations: this.validate(input, findings, scores),
    };
  }

  rebuild(input: AnalysisInput) {
    return this.analyze(input);
  }

  detectFindings(input: AnalysisInput): DetectedFinding[] {
    return input.rules
      .filter((rule) => this.evaluate(rule.evaluationLogic, input))
      .map((rule) => this.toFinding(rule, input))
      .sort(
        (left, right) =>
          RISK_POINTS[right.rule.severity] - RISK_POINTS[left.rule.severity] ||
          left.rule.code.localeCompare(right.rule.code),
      );
  }

  calculateRisk(findings: DetectedFinding[]) {
    const raw = findings.reduce((total, finding) => total + finding.riskPoints, 0);
    return { score: clamp(raw), formula: "min(100, sum(severity points))", raw };
  }

  calculateScores(findings: DetectedFinding[]): AnalysisScore[] {
    const exposure = (codes: string[]) =>
      clamp(
        findings
          .filter((finding) => codes.includes(finding.rule.code))
          .reduce((sum, finding) => sum + finding.riskPoints, 0),
      );
    const score = (
      code: string,
      label: string,
      direction: AnalysisScore["direction"],
      findingCodes: string[],
    ): AnalysisScore => {
      const contributions = findings
        .filter((finding) => findingCodes.includes(finding.rule.code))
        .map((finding) => ({ finding: finding.identifier, points: finding.riskPoints }));
      const total = exposure(findingCodes);
      return {
        code,
        label,
        direction,
        score: direction === "higher_is_better" ? 100 - total : total,
        calculation: {
          formula:
            direction === "higher_is_better"
              ? "max(0, 100 - sum(severity points))"
              : "min(100, sum(severity points))",
          contributions,
        },
      };
    };
    return [
      score("process_quality", "Process Quality", "higher_is_better", [
        "disconnected_process",
        "incomplete_process",
        "duplicate_manual_entry",
      ]),
      score("manual_work", "Manual Work", "higher_is_exposure", [
        "high_manual_workload",
        "manual_document_transfer",
        "manual_invoice_processing",
      ]),
      score("operational_risk", "Operational Risk", "higher_is_exposure", [
        "single_point_of_failure",
        "human_bottleneck",
        "missing_approval",
      ]),
      score("documentation", "Documentation", "higher_is_better", [
        "missing_documentation",
        "missing_kpi",
      ]),
      score("digitalization", "Digitalization", "higher_is_better", [
        "excel_dependency",
        "email_dependency",
        "paper_document",
        "missing_business_system",
      ]),
      score("automation_potential", "Automation Potential", "higher_is_exposure", [
        "duplicate_manual_entry",
        "high_manual_workload",
        "manual_invoice_processing",
        "repeated_validation",
      ]),
      score("ai_potential", "AI Potential", "higher_is_exposure", [
        "manual_document_transfer",
        "email_dependency",
        "missing_documentation",
      ]),
      score("data_quality", "Data Quality", "higher_is_better", [
        "low_confidence_process",
        "incomplete_process",
      ]),
      score("ownership", "Ownership", "higher_is_better", [
        "missing_process_owner",
        "single_point_of_failure",
      ]),
    ];
  }

  calculateHealth(scores: AnalysisScore[]): AnalysisHealth[] {
    const byCode = new Map(scores.map((score) => [score.code, score]));
    const better = (code: string) => {
      const item = byCode.get(code);
      if (!item) return 0;
      return item.direction === "higher_is_better" ? item.score : 100 - item.score;
    };
    const health = (dimension: string, sourceScores: string[]): AnalysisHealth => ({
      dimension,
      scopeType: "organization",
      scopeReferenceId: null,
      score: round(sourceScores.reduce((sum, code) => sum + better(code), 0) / sourceScores.length),
      calculation: { formula: "mean(normalized source scores)", sourceScores },
    });
    return [
      health("organization_health", [
        "process_quality",
        "operational_risk",
        "documentation",
        "digitalization",
        "data_quality",
        "ownership",
      ]),
      health("department_health", ["process_quality", "operational_risk", "ownership"]),
      health("process_health", ["process_quality", "manual_work", "operational_risk"]),
      health("system_health", ["digitalization", "data_quality"]),
      health("documentation_health", ["documentation", "data_quality"]),
      health("ownership_health", ["ownership", "operational_risk"]),
      health("automation_readiness", ["digitalization", "data_quality", "process_quality"]),
      health("ai_readiness", ["digitalization", "data_quality", "documentation"]),
    ];
  }

  validate(input: AnalysisInput, findings: DetectedFinding[], scores: AnalysisScore[]) {
    const validations: {
      code: string;
      severity: "error" | "warning" | "information";
      message: string;
    }[] = [];
    if (input.processMap.status !== "published")
      validations.push({
        code: "source_not_published",
        severity: "error",
        message: "Source process map must be published",
      });
    if (findings.some((finding) => finding.evidenceFactIds.length === 0))
      validations.push({
        code: "missing_evidence",
        severity: "error",
        message: "Every finding requires Enterprise Knowledge evidence",
      });
    if (scores.some((score) => !score.calculation.formula))
      validations.push({
        code: "missing_score_trace",
        severity: "error",
        message: "Every score requires a visible formula",
      });
    if (validations.length === 0)
      validations.push({
        code: "analysis_valid",
        severity: "information",
        message: "Analysis validation passed",
      });
    return validations;
  }

  publish<T>(analysis: T) {
    return Object.freeze(analysis);
  }

  private evaluate(logic: Record<string, unknown>, input: AnalysisInput) {
    const operator = logic.operator;
    const manual = input.nodes.filter((node) => node.executionMode === "manual");
    const steps = input.nodes.filter((node) => ["step", "decision"].includes(node.type));
    const searchable =
      `${input.processMap.name} ${input.nodes.map((node) => `${node.name} ${node.description ?? ""}`).join(" ")} ${input.facts.map((fact) => `${fact.key} ${JSON.stringify(fact.value)}`).join(" ")}`.toLowerCase();
    const approvals = steps.filter((node) => /approv|valid/i.test(node.name));
    const actorCounts = countBy(manual.map((node) => node.actorId).filter(isString));
    const actorMinutes = sumByActor(manual);
    const totalManualMinutes = manual.reduce((sum, node) => sum + (node.durationMinutes ?? 0), 0);
    switch (operator) {
      case "duplicateManualStep":
        return (
          Math.max(0, ...Object.values(countBy(manual.map((node) => normalize(node.name))))) >=
          Number(logic.minimum)
        );
      case "actorManualShare":
        return (
          manual.length >= Number(logic.minimumSteps) &&
          maxShare(actorCounts, manual.length) >= Number(logic.threshold)
        );
      case "missingOwner":
        return input.processMap.ownerId === null;
      case "missingApproval":
        return (
          includesAny(input.processMap.name.toLowerCase(), logic.processTerms) &&
          approvals.length === 0
        );
      case "approvalCount":
      case "validationStepCount":
        return approvals.length >= Number(logic.minimum);
      case "manualDocumentTransfer":
        return manual.some((node) =>
          /document|paper|papier|file|fichier/i.test(`${node.name} ${node.description ?? ""}`),
        );
      case "manualInvoice":
        return manual.some((node) =>
          /invoice|facture/i.test(
            `${node.name} ${node.description ?? ""} ${input.processMap.name}`,
          ),
        );
      case "systemContains":
      case "textContains":
        return includesAny(searchable, logic.terms);
      case "missingSystem":
        return input.processMap.systemIds.length === 0;
      case "undocumentedShare":
        return (
          steps.length > 0 &&
          (steps.filter((node) => !node.description?.trim()).length / steps.length) * 100 >
            Number(logic.threshold)
        );
      case "validationCode":
        return input.processMap.validationCodes.some((code) =>
          toStrings(logic.codes).includes(code),
        );
      case "manualHoursMonthly":
        return totalManualMinutes / 60 >= Number(logic.threshold);
      case "processMetricBelow":
        return (
          (logic.metric === "confidence"
            ? input.processMap.confidence
            : input.processMap.completeness) < Number(logic.threshold)
        );
      case "missingKnowledgeTerm":
        return !toStrings(logic.terms).some((term) => searchable.includes(term));
      case "actorManualDurationShare":
        return (
          totalManualMinutes > 0 &&
          maxShare(actorMinutes, totalManualMinutes) >= Number(logic.threshold)
        );
      default:
        return false;
    }
  }

  private toFinding(rule: AnalysisRule, input: AnalysisInput): DetectedFinding {
    const facts = input.facts.filter((fact) =>
      `${fact.key} ${fact.domain} ${JSON.stringify(fact.value)}`
        .toLowerCase()
        .includes(rule.code.split("_")[0] ?? ""),
    );
    const evidenceFacts = facts.length ? facts : input.facts.slice(0, 1);
    const step = input.nodes.find((node) => this.nodeMatches(rule.code, node)) ?? null;
    const confidence = evidenceFacts.length
      ? round(evidenceFacts.reduce((sum, fact) => sum + fact.confidence, 0) / evidenceFacts.length)
      : input.processMap.confidence;
    return {
      identifier: `${rule.code}:${step?.key ?? "process"}`,
      rule,
      description: rule.explanationTemplate,
      relatedStepId: step?.id ?? null,
      relatedDepartmentId: step?.departmentId ?? null,
      relatedActorId: step?.actorId ?? null,
      relatedSystemId: step?.systemId ?? null,
      confidence,
      businessImpact: rule.recommendationHint ?? rule.description,
      riskPoints: RISK_POINTS[rule.severity],
      evidenceFactIds: evidenceFacts.map((fact) => fact.id),
      evidence: { ruleVersion: rule.version, processMapId: input.processMap.id },
    };
  }

  private nodeMatches(code: string, node: AnalysisNode) {
    const text = `${node.name} ${node.description ?? ""}`.toLowerCase();
    return code.split("_").some((part) => part.length > 4 && text.includes(part));
  }
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, round(value)));
}
function round(value: number) {
  return Math.round(value * 100) / 100;
}
function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
function isString(value: string | null): value is string {
  return typeof value === "string";
}
function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}
function sumByActor(nodes: AnalysisNode[]) {
  return nodes.reduce<Record<string, number>>((totals, node) => {
    if (node.actorId)
      totals[node.actorId] = (totals[node.actorId] ?? 0) + (node.durationMinutes ?? 0);
    return totals;
  }, {});
}
function maxShare(values: Record<string, number>, total: number) {
  return total === 0 ? 0 : (Math.max(0, ...Object.values(values)) / total) * 100;
}
function toStrings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
function includesAny(text: string, terms: unknown) {
  return toStrings(terms).some((term) => text.includes(term.toLowerCase()));
}
