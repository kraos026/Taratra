export type AiComplexity = "very_low" | "low" | "medium" | "high" | "very_high";
export type AiRisk = "low" | "medium" | "high" | "critical";

export interface AiFindingInput {
  id: string;
  identifier: string;
  ruleCode: string;
  severity: "critical" | "high" | "medium" | "low" | "information";
  confidence: number;
  processId: string;
  departmentId: string | null;
  systemId: string | null;
  factIds: string[];
}
export interface AiFactInput {
  id: string;
  key: string;
  domain: string;
  value: unknown;
  confidence: number;
}
export interface AiCapabilityInput {
  id: string;
  code: string;
  version: number;
  title: string;
  description: string;
  requiredData: string[];
  expectedOutputs: string[];
  limitations: string[];
  complexity: AiComplexity;
}
export interface AiDetectionRuleInput {
  id: string;
  code: string;
  version: number;
  title: string;
  findingCodes: string[];
  processTerms: string[];
  knowledgeTerms: string[];
  capabilityCodes: string[];
  businessProblem: string;
  impact: string;
  risk: AiRisk;
}
export interface AiScoreDefinitionInput {
  id: string;
  code: string;
  version: number;
  formula: Record<string, unknown>;
}
export interface AiOpportunityInput {
  analysisId: string;
  analysisStatus: string;
  processMapId: string;
  processMapStatus: string;
  processName: string;
  processConfidence: number;
  knowledgeSnapshotId: string;
  findings: AiFindingInput[];
  facts: AiFactInput[];
  capabilities: AiCapabilityInput[];
  detectionRules: AiDetectionRuleInput[];
  scoreDefinitions: AiScoreDefinitionInput[];
}
export interface AiScoreResult {
  definition: AiScoreDefinitionInput;
  score: number;
  calculation: Record<string, unknown>;
}
export interface AiOpportunityResult {
  identifier: string;
  title: string;
  description: string;
  businessProblem: string;
  rule: AiDetectionRuleInput;
  capabilities: AiCapabilityInput[];
  findings: AiFindingInput[];
  evidenceFacts: AiFactInput[];
  confidence: number;
  feasibility: number;
  businessImpact: number;
  technicalComplexity: number;
  dataReadiness: number;
  aiReadiness: number;
  implementationEffort: AiComplexity;
  risk: AiRisk;
  processIds: string[];
  departmentIds: string[];
  systemIds: string[];
  prerequisites: { code: string; description: string; satisfied: boolean }[];
  scores: AiScoreResult[];
}

const SEVERITY_SCORE = { critical: 100, high: 75, medium: 50, low: 25, information: 10 };
const COMPLEXITY_SCORE: Record<AiComplexity, number> = {
  very_low: 20,
  low: 40,
  medium: 60,
  high: 80,
  very_high: 100,
};
const COMPLEXITY_ORDER: AiComplexity[] = ["very_low", "low", "medium", "high", "very_high"];

export class AiOpportunityEngine {
  detect(input: AiOpportunityInput) {
    const opportunities = input.detectionRules
      .filter((rule) => this.matches(rule, input))
      .map((rule) => this.build(rule, input))
      .filter((opportunity): opportunity is AiOpportunityResult => opportunity !== null)
      .sort(
        (left, right) =>
          right.businessImpact - left.businessImpact ||
          left.identifier.localeCompare(right.identifier),
      );
    return {
      opportunities,
      validations: this.validate(input, opportunities),
      catalogVersions: {
        capabilities: input.capabilities.map(({ id, code, version }) => ({ id, code, version })),
        detectionRules: input.detectionRules.map(({ id, code, version }) => ({
          id,
          code,
          version,
        })),
        scoreDefinitions: input.scoreDefinitions.map(({ id, code, version }) => ({
          id,
          code,
          version,
        })),
      },
    };
  }

  rebuild(input: AiOpportunityInput) {
    return this.detect(input);
  }

  validate(input: AiOpportunityInput, opportunities: AiOpportunityResult[]) {
    const errors: { code: string; severity: "error" | "information"; message: string }[] = [];
    if (input.analysisStatus !== "published")
      errors.push({
        code: "analysis_not_published",
        severity: "error",
        message: "Source Business Analysis must be published",
      });
    if (input.processMapStatus !== "published")
      errors.push({
        code: "process_not_published",
        severity: "error",
        message: "Source Process Map must be published",
      });
    for (const opportunity of opportunities) {
      if (!opportunity.findings.length)
        errors.push({
          code: "missing_related_finding",
          severity: "error",
          message: `${opportunity.identifier} has no related finding`,
        });
      if (!opportunity.evidenceFacts.length)
        errors.push({
          code: "missing_evidence",
          severity: "error",
          message: `${opportunity.identifier} has no Knowledge evidence`,
        });
      if (!opportunity.capabilities.length)
        errors.push({
          code: "unknown_capability",
          severity: "error",
          message: `${opportunity.identifier} has no known capability`,
        });
      if (opportunity.scores.length !== 6)
        errors.push({
          code: "unknown_score_definition",
          severity: "error",
          message: `${opportunity.identifier} lacks score definitions`,
        });
    }
    return errors.length
      ? errors
      : [
          {
            code: "ai_opportunities_valid",
            severity: "information" as const,
            message: "AI opportunities validation passed",
          },
        ];
  }

  publish<T>(snapshot: T) {
    return Object.freeze(snapshot);
  }

  private matches(rule: AiDetectionRuleInput, input: AiOpportunityInput) {
    const findingMatch =
      rule.findingCodes.length === 0 ||
      input.findings.some((finding) => rule.findingCodes.includes(finding.ruleCode));
    const process = input.processName.toLowerCase();
    const processMatch =
      rule.processTerms.length === 0 ||
      rule.processTerms.some((term) => process.includes(term.toLowerCase()));
    const knowledge = input.facts
      .map((fact) => `${fact.key} ${fact.domain} ${JSON.stringify(fact.value)}`)
      .join(" ")
      .toLowerCase();
    const knowledgeMatch =
      rule.knowledgeTerms.length === 0 ||
      rule.knowledgeTerms.some((term) => knowledge.includes(term.toLowerCase()));
    return findingMatch && processMatch && knowledgeMatch && input.findings.length > 0;
  }

  private build(rule: AiDetectionRuleInput, input: AiOpportunityInput): AiOpportunityResult | null {
    const findings = rule.findingCodes.length
      ? input.findings.filter((finding) => rule.findingCodes.includes(finding.ruleCode))
      : input.findings.slice(0, 1);
    const factIds = new Set(findings.flatMap((finding) => finding.factIds));
    const evidenceFacts = input.facts.filter((fact) => factIds.has(fact.id));
    const capabilities = rule.capabilityCodes
      .map((code) => input.capabilities.find((capability) => capability.code === code))
      .filter((capability): capability is AiCapabilityInput => Boolean(capability));
    if (!findings.length || !capabilities.length) return null;
    const complexity = capabilities.reduce<AiComplexity>(
      (highest, capability) =>
        COMPLEXITY_ORDER.indexOf(capability.complexity) > COMPLEXITY_ORDER.indexOf(highest)
          ? capability.complexity
          : highest,
      "very_low",
    );
    const technicalComplexity = COMPLEXITY_SCORE[complexity];
    const requiredData = [
      ...new Set(capabilities.flatMap((capability) => capability.requiredData)),
    ];
    const searchable = input.facts
      .map((fact) => `${fact.key} ${fact.domain} ${JSON.stringify(fact.value)}`)
      .join(" ")
      .toLowerCase();
    const satisfied = requiredData.filter((required) =>
      required
        .split("_")
        .some((term) => term.length > 3 && searchable.includes(term.toLowerCase())),
    );
    const dataReadiness =
      requiredData.length === 0 ? 100 : round((satisfied.length / requiredData.length) * 100);
    const findingConfidence = average(findings.map((finding) => finding.confidence));
    const evidenceConfidence = evidenceFacts.length
      ? average(evidenceFacts.map((fact) => fact.confidence))
      : 0;
    const confidence = round((findingConfidence + evidenceConfidence) / 2);
    const businessImpact = Math.max(...findings.map((finding) => SEVERITY_SCORE[finding.severity]));
    const feasibility = round(
      dataReadiness * 0.35 +
        confidence * 0.25 +
        (100 - technicalComplexity) * 0.25 +
        input.processConfidence * 0.15,
    );
    const knowledgeConfidence = evidenceConfidence;
    const aiReadiness = round((dataReadiness + feasibility + knowledgeConfidence) / 3);
    const values: Record<string, number> = {
      business_impact: businessImpact,
      implementation_complexity: technicalComplexity,
      data_readiness: dataReadiness,
      confidence,
      feasibility,
      ai_readiness: aiReadiness,
    };
    const scores = input.scoreDefinitions
      .filter((definition) => definition.code in values)
      .map((definition) => ({
        definition,
        score: values[definition.code]!,
        calculation: {
          formula: definition.formula,
          inputs: {
            findingConfidence,
            evidenceConfidence,
            processConfidence: input.processConfidence,
            technicalComplexity,
            requiredData,
            satisfiedData: satisfied,
          },
        },
      }));
    return {
      identifier: `${rule.code}:${input.processMapId}`,
      title: rule.title,
      description: rule.impact,
      businessProblem: rule.businessProblem,
      rule,
      capabilities,
      findings,
      evidenceFacts,
      confidence,
      feasibility,
      businessImpact,
      technicalComplexity,
      dataReadiness,
      aiReadiness,
      implementationEffort: complexity,
      risk: rule.risk,
      processIds: [input.processMapId],
      departmentIds: unique(findings.map((finding) => finding.departmentId).filter(isString)),
      systemIds: unique(findings.map((finding) => finding.systemId).filter(isString)),
      prerequisites: requiredData.map((code) => ({
        code,
        description: `Required governed data: ${code}`,
        satisfied: satisfied.includes(code),
      })),
      scores,
    };
  }
}

function round(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}
function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
function unique(values: string[]) {
  return [...new Set(values)];
}
function isString(value: string | null): value is string {
  return typeof value === "string";
}
