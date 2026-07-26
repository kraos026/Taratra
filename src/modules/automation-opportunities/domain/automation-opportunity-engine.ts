export type AutomationComplexity = "very_low" | "low" | "medium" | "high" | "very_high";
export type FindingSeverity = "critical" | "high" | "medium" | "low" | "information";

export interface AutomationFinding {
  id: string;
  code: string;
  severity: FindingSeverity;
  confidence: number;
  processId: string;
  departmentId: string | null;
  systemId: string | null;
  factIds: string[];
}
export interface AutomationFact {
  id: string;
  key: string;
  domain: string;
  value: unknown;
  confidence: number;
}
export interface SourceAiOpportunity {
  id: string;
  capabilityCodes: string[];
  confidence: number;
}
export interface AutomationPattern {
  id: string;
  code: string;
  version: number;
  title: string;
  description: string;
  outputs: string[];
  complexity: AutomationComplexity;
}
export interface AutomationConnector {
  id: string;
  code: string;
  version: number;
  title: string;
  aliases: string[];
}
export interface AutomationRule {
  id: string;
  code: string;
  version: number;
  title: string;
  findingCodes: string[];
  aiCapabilityCodes: string[];
  patternCode: string;
  connectorCodes: string[];
  triggerType: string;
  actions: string[];
  businessProblem: string;
  impact: string;
}
export interface AutomationScoreDefinition {
  id: string;
  code: string;
  version: number;
  formula: Record<string, unknown>;
}
export interface AutomationInput {
  aiSnapshotId: string;
  aiSnapshotStatus: string;
  analysisId: string;
  analysisStatus: string;
  processMapId: string;
  processMapStatus: string;
  knowledgeSnapshotId: string;
  findings: AutomationFinding[];
  facts: AutomationFact[];
  aiOpportunities: SourceAiOpportunity[];
  patterns: AutomationPattern[];
  connectors: AutomationConnector[];
  rules: AutomationRule[];
  scoreDefinitions: AutomationScoreDefinition[];
}
export interface AutomationResultItem {
  identifier: string;
  title: string;
  description: string;
  businessProblem: string;
  pattern: AutomationPattern;
  rule: AutomationRule;
  connectors: { connector: AutomationConnector | undefined; available: boolean }[];
  aiLinks: SourceAiOpportunity[];
  findings: AutomationFinding[];
  evidence: AutomationFact[];
  triggerType: string;
  actions: string[];
  outputs: string[];
  businessImpact: number;
  automationCoverage: number;
  technicalFeasibility: number;
  connectorAvailability: number;
  automationReadiness: number;
  complexity: number;
  confidence: number;
  implementationEffort: AutomationComplexity;
  processIds: string[];
  departmentIds: string[];
  systemIds: string[];
  scores: {
    definition: AutomationScoreDefinition;
    score: number;
    calculation: Record<string, unknown>;
  }[];
}
export interface AutomationDetectionResult {
  opportunities: AutomationResultItem[];
  validations: { code: string; severity: "error" | "information"; message: string }[];
  catalogVersions: Record<string, { id: string; code: string; version: number }[]>;
}

const SEVERITY = { critical: 100, high: 75, medium: 50, low: 25, information: 10 };
const COMPLEXITY: Record<AutomationComplexity, number> = {
  very_low: 20,
  low: 40,
  medium: 60,
  high: 80,
  very_high: 100,
};
const TRIGGERS = new Set([
  "Manual",
  "Scheduled",
  "Webhook",
  "API",
  "Database Event",
  "Email Received",
  "File Uploaded",
  "Form Submitted",
  "Approval",
]);
const ACTIONS = new Set([
  "Read",
  "Write",
  "Transform",
  "Notify",
  "Create",
  "Update",
  "Delete",
  "Send",
  "Archive",
  "Approve",
  "Extract",
  "Validate",
]);

export class AutomationOpportunityEngine {
  detect(input: AutomationInput): AutomationDetectionResult {
    const opportunities = input.rules
      .flatMap((rule) => {
        const findings = input.findings.filter((finding) =>
          rule.findingCodes.includes(finding.code),
        );
        const aiLinks = input.aiOpportunities.filter((opportunity) =>
          rule.aiCapabilityCodes.some((code) => opportunity.capabilityCodes.includes(code)),
        );
        if (!findings.length || (rule.aiCapabilityCodes.length && !aiLinks.length)) return [];
        const pattern = input.patterns.find((item) => item.code === rule.patternCode);
        if (!pattern) return [];
        const connectors = rule.connectorCodes.map((code) => ({
          connector: input.connectors.find((item) => item.code === code),
          available: this.connectorAvailable(code, input),
        }));
        const evidence = input.facts.filter((fact) =>
          findings.some((finding) => finding.factIds.includes(fact.id)),
        );
        const complexity = COMPLEXITY[pattern.complexity];
        const connectorAvailability = percent(
          connectors.filter((item) => item.available).length,
          connectors.length,
          100,
        );
        const businessImpact = Math.max(...findings.map((item) => SEVERITY[item.severity]));
        const automationCoverage = percent(
          findings.length,
          input.findings.filter((item) => rule.findingCodes.includes(item.code)).length,
        );
        const findingConfidence = average(findings.map((item) => item.confidence));
        const evidenceConfidence = average(evidence.map((item) => item.confidence));
        const aiConfidence = average(aiLinks.map((item) => item.confidence));
        const confidence = aiLinks.length
          ? round(findingConfidence * 0.5 + aiConfidence * 0.25 + evidenceConfidence * 0.25)
          : round(findingConfidence * (2 / 3) + evidenceConfidence * (1 / 3));
        const inputReadiness = evidence.length ? 100 : 0;
        const technicalFeasibility = round(
          connectorAvailability * 0.35 +
            inputReadiness * 0.25 +
            (100 - complexity) * 0.25 +
            confidence * 0.15,
        );
        const automationReadiness = round(
          (automationCoverage + technicalFeasibility + connectorAvailability + confidence) / 4,
        );
        const values = {
          automation_coverage: automationCoverage,
          business_impact: businessImpact,
          technical_feasibility: technicalFeasibility,
          connector_availability: connectorAvailability,
          automation_readiness: automationReadiness,
          complexity,
          confidence,
        };
        return [
          {
            identifier: `${rule.code}:${input.processMapId}`,
            title: rule.title,
            description: rule.impact,
            businessProblem: rule.businessProblem,
            pattern,
            rule,
            connectors,
            aiLinks,
            findings,
            evidence,
            triggerType: rule.triggerType,
            actions: rule.actions,
            outputs: pattern.outputs,
            businessImpact,
            automationCoverage,
            technicalFeasibility,
            connectorAvailability,
            automationReadiness,
            complexity,
            confidence,
            implementationEffort: pattern.complexity,
            processIds: unique(findings.map((item) => item.processId)),
            departmentIds: unique(findings.map((item) => item.departmentId).filter(isString)),
            systemIds: unique(findings.map((item) => item.systemId).filter(isString)),
            scores: input.scoreDefinitions
              .filter((definition) => definition.code in values)
              .map((definition) => ({
                definition,
                score: values[definition.code as keyof typeof values],
                calculation: {
                  formula: definition.formula,
                  inputs: {
                    findingConfidence,
                    aiConfidence,
                    evidenceConfidence,
                    inputReadiness,
                    complexity,
                    connectorAvailability,
                    automationCoverage,
                  },
                },
              })),
          },
        ];
      })
      .sort(
        (a, b) => b.businessImpact - a.businessImpact || a.identifier.localeCompare(b.identifier),
      );
    return {
      opportunities,
      validations: this.validate(input, opportunities),
      catalogVersions: {
        patterns: input.patterns.map(({ id, code, version }) => ({ id, code, version })),
        connectors: input.connectors.map(({ id, code, version }) => ({ id, code, version })),
        rules: input.rules.map(({ id, code, version }) => ({ id, code, version })),
        scoreDefinitions: input.scoreDefinitions.map(({ id, code, version }) => ({
          id,
          code,
          version,
        })),
      },
    };
  }
  rebuild(input: AutomationInput) {
    return this.detect(input);
  }
  publish<T>(value: T) {
    return Object.freeze(value);
  }
  validate(input: AutomationInput, opportunities: AutomationResultItem[]) {
    const errors: { code: string; severity: "error" | "information"; message: string }[] = [];
    if (input.aiSnapshotStatus !== "published")
      errors.push(error("ai_opportunity_not_published", "Source AI Opportunity must be published"));
    if (input.analysisStatus !== "published")
      errors.push(error("analysis_not_published", "Source Business Analysis must be published"));
    if (input.processMapStatus !== "published")
      errors.push(error("process_map_not_published", "Source Process Map must be published"));
    for (const item of opportunities) {
      if (!item.evidence.length)
        errors.push(error("missing_evidence", `${item.identifier} has no evidence`));
      if (!item.pattern) errors.push(error("missing_pattern", `${item.identifier} has no pattern`));
      if (item.connectors.some(({ connector }) => !connector))
        errors.push(
          error("unknown_connector", `${item.identifier} references an unknown connector`),
        );
      if (!TRIGGERS.has(item.triggerType))
        errors.push(error("unknown_trigger", `${item.identifier} has an unknown trigger`));
      if (item.actions.some((action) => !ACTIONS.has(action)))
        errors.push(error("unknown_action", `${item.identifier} has an unknown action`));
      if (item.scores.length !== 7)
        errors.push(
          error("unknown_score_definition", `${item.identifier} lacks score definitions`),
        );
    }
    return errors.length
      ? errors
      : [
          {
            code: "automation_opportunities_valid",
            severity: "information" as const,
            message: "Automation opportunities validation passed",
          },
        ];
  }
  private connectorAvailable(code: string, input: AutomationInput) {
    const connector = input.connectors.find((item) => item.code === code);
    if (!connector) return false;
    const text = input.facts
      .map((fact) => `${fact.key} ${fact.domain} ${JSON.stringify(fact.value)}`)
      .join(" ")
      .toLowerCase();
    return [connector.code, connector.title, ...connector.aliases].some((term) =>
      text.includes(term.toLowerCase()),
    );
  }
}
function error(code: string, message: string) {
  return { code, severity: "error" as const, message };
}
function round(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}
function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
function percent(value: number, total: number, empty = 0) {
  return total ? round((value / total) * 100) : empty;
}
function unique(values: string[]) {
  return [...new Set(values)];
}
function isString(value: string | null): value is string {
  return value !== null;
}
