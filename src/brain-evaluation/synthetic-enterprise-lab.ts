export type SyntheticScenarioCategory =
  | "CLEAN"
  | "AMBIGUOUS"
  | "CONTRADICTORY"
  | "BROKEN_PROCESS"
  | "DATA_QUALITY_FAILURE"
  | "HUMAN_CONTROL_REQUIRED"
  | "LOW_VALUE_AUTOMATION"
  | "HIGH_VALUE_AUTOMATION"
  | "HIGH_RISK_AI"
  | "SYSTEM_FRAGMENTATION"
  | "SINGLE_PERSON_DEPENDENCY"
  | "HIGH_REWORK"
  | "OBSERVABILITY_GAP";
export interface SyntheticScenarioProfile {
  sector: string;
  companySize: string;
  processComplexity: number;
  dataQuality: number;
  automationMaturity: number;
  systemFragmentation: number;
  humanDependency: number;
  exceptionRate: number;
  controlIntensity: number;
  documentationQuality: number;
  organizationalMaturity: number;
  riskLevel: number;
  category: SyntheticScenarioCategory;
}
export interface SyntheticActor {
  id: string;
  role: string;
  knowledgeScope: readonly string[];
  reliability: number;
  bias: number;
  informationFreshness: number;
  roleVisibility: number;
  confidence: number;
  beliefs: Readonly<Record<string, string | number>>;
}
export interface SyntheticSystem {
  id: string;
  systemType: string;
  capabilities: readonly string[];
  dataQuality: number;
  availability: number;
  latency: number;
  api: boolean;
  read: boolean;
  write: boolean;
  events: boolean;
  batch: boolean;
  authenticationConstraints: readonly string[];
  failureModes: readonly string[];
}
export interface SyntheticProcess {
  id: string;
  name: string;
  steps: readonly {
    id: string;
    actorId: string;
    systemId: string;
    action: string;
    handoff?: string;
    control?: string;
  }[];
  dependencies: readonly string[];
  bottleneck: string;
  rootCause: string;
  exceptions: readonly string[];
  queues: readonly string[];
  delays: readonly string[];
  failureModes: readonly string[];
}
export interface SyntheticInterview {
  id: string;
  actorId: string;
  question: string;
  answer: string | number | null;
  status: "ACCURATE" | "ESTIMATE" | "STALE" | "BIASED" | "PARTIAL" | "CONTRADICTORY" | "UNKNOWN";
  sourceReference: string;
}
export interface SyntheticMetric {
  id: string;
  name: string;
  value: number | null;
  unit: string;
  period: string;
  sourceReference: string;
}
export interface SyntheticIncident {
  id: string;
  type: string;
  timestamp: string;
  scope: string;
  cause: string;
  impact: string;
  duration: string;
}
export interface SyntheticGroundTruth {
  trueProcessStructure: readonly string[];
  trueMetrics: Readonly<Record<string, number>>;
  trueRootCause: string;
  actualBottleneck: string;
  hiddenCapabilities: readonly string[];
  economicallyJustified: readonly string[];
  forbiddenRecommendations: readonly string[];
  expectedDecision: string;
  expectedHumanControl: boolean;
  actualVolumes: Readonly<Record<string, number>>;
  actualDependencies: readonly string[];
  actualControls: readonly string[];
  failureProbabilities: Readonly<Record<string, number>>;
  dataQualityState: number;
  expectedClarifications: readonly string[];
  expectedEconomicDirection: "POSITIVE" | "NEGATIVE" | "UNKNOWN";
}
export interface SyntheticEnterpriseView {
  enterpriseId: string;
  seed: string;
  generatorVersion: string;
  sector: string;
  companySize: string;
  region: string;
  departments: readonly string[];
  roles: readonly string[];
  actors: readonly SyntheticActor[];
  systems: readonly SyntheticSystem[];
  processes: readonly SyntheticProcess[];
  interviews: readonly SyntheticInterview[];
  metrics: readonly SyntheticMetric[];
  documents: readonly { id: string; type: string; content: string; sourceReference: string }[];
  incidents: readonly SyntheticIncident[];
  events: readonly { id: string; type: string; timestamp: string }[];
  timeline: readonly { period: string; change: string }[];
  constraints: readonly string[];
  controls: readonly string[];
  risks: readonly string[];
}
export interface SyntheticEnterprise extends SyntheticEnterpriseView {
  readonly _groundTruth: SyntheticGroundTruth;
}
export interface ScenarioDataset {
  scenarioId: string;
  generatorVersion: string;
  seed: string;
  publicView: SyntheticEnterpriseView;
  groundTruthReference: string;
  evaluationExpectations: {
    expectedRootCauseIds: readonly string[];
    expectedOpportunityTypes: readonly string[];
    forbiddenOpportunityTypes: readonly string[];
    expectedDecisionClass: string;
    expectedHumanControl: boolean;
    expectedUnknowns: readonly string[];
  };
  tags: readonly string[];
}

const freeze = <T>(x: T): T => Object.freeze(x);
const hash = (seed: string) => [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
export class SyntheticEnterpriseGenerator {
  generate(
    seed: string,
    generatorVersion: string,
    profile: SyntheticScenarioProfile,
  ): SyntheticEnterprise {
    const h = hash(`${seed}:${generatorVersion}`);
    const id = `synthetic:${seed}`;
    const systems = freeze([
      {
        id: "crm",
        systemType: "CRM",
        capabilities: freeze(["READ_DATA", "WRITE_DATA"]),
        dataQuality: profile.dataQuality,
        availability: 0.98,
        latency: 120,
        api: true,
        read: true,
        write: true,
        events: false,
        batch: true,
        authenticationConstraints: freeze(["service credential required"]),
        failureModes: freeze(["timeout", "partial write"]),
      },
      {
        id: "erp",
        systemType: "ERP",
        capabilities: freeze(["READ_DATA", "WRITE_DATA"]),
        dataQuality: profile.dataQuality,
        availability: 0.97,
        latency: 180,
        api: profile.systemFragmentation < 0.8,
        read: true,
        write: true,
        events: false,
        batch: true,
        authenticationConstraints: freeze(["rotating credential"]),
        failureModes: freeze(["stale data", "duplicate event"]),
      },
    ]);
    const actors = freeze(
      [
        "owner",
        "manager",
        "operator",
        "finance",
        "IT",
        "customer-facing-employee",
        "process-owner",
      ].map((role, i) =>
        freeze({
          id: `actor-${role}`,
          role,
          knowledgeScope: freeze(
            role === "IT" ? ["API capabilities", "availability"] : ["orders", "approvals"],
          ),
          reliability: 0.7 + ((h + i) % 20) / 100,
          bias: profile.category === "AMBIGUOUS" ? 0.4 : 0.1,
          informationFreshness: 0.8,
          roleVisibility: 0.7,
          confidence: 0.7,
          beliefs: freeze({
            volume: i === 1 ? 100 : role === "customer-facing-employee" ? 55 : 62,
          }),
        }),
      ),
    );
    const process = freeze([
      {
        id: "order-flow",
        name: "Order processing",
        steps: freeze([
          {
            id: "capture",
            actorId: "actor-operator",
            systemId: "crm",
            action: "capture order",
            handoff: "erp",
          },
          {
            id: "write",
            actorId: "actor-operator",
            systemId: "erp",
            action: "copy order",
            control: profile.controlIntensity > 0.7 ? "financial approval" : undefined,
          },
          { id: "approve", actorId: "actor-finance", systemId: "erp", action: "approve" },
        ]),
        dependencies: freeze(["master-data"]),
        bottleneck: profile.controlIntensity > 0.7 ? "approve" : "write",
        rootCause: profile.dataQuality < 0.5 ? "poor-master-data" : "system-fragmentation",
        exceptions: freeze(["missing customer data", "approval timeout"]),
        queues: freeze(["finance-approval-queue"]),
        delays: freeze(["approval delay"]),
        failureModes: freeze(["duplicate entry", "stale master data"]),
      },
    ]);
    const secondaryStatus =
      profile.category === "AMBIGUOUS"
        ? ("BIASED" as const)
        : profile.category === "OBSERVABILITY_GAP"
          ? ("UNKNOWN" as const)
          : profile.category === "SINGLE_PERSON_DEPENDENCY"
            ? ("PARTIAL" as const)
            : profile.category === "HIGH_REWORK"
              ? ("STALE" as const)
              : ("ESTIMATE" as const);
    const interviews = freeze([
      {
        id: "interview-owner",
        actorId: "actor-owner",
        question: "orders per day",
        answer: profile.category === "CONTRADICTORY" ? 100 : 62,
        status:
          profile.category === "CONTRADICTORY" ? ("CONTRADICTORY" as const) : ("ACCURATE" as const),
        sourceReference: "interview-owner:1",
      },
      {
        id: "interview-operator",
        actorId: "actor-operator",
        question: "orders per day",
        answer: 55,
        status: secondaryStatus,
        sourceReference: "interview-operator:1",
      },
    ]);
    const metrics = freeze([
      {
        id: "metric-volume",
        name: "orders/day",
        value: 62,
        unit: "orders/day",
        period: "month-1",
        sourceReference: "system-log:1",
      },
      {
        id: "metric-errors",
        name: "error-rate",
        value: profile.dataQuality < 0.5 ? 0.12 : 0.03,
        unit: "ratio",
        period: "month-1",
        sourceReference: "system-log:2",
      },
      {
        id: "metric-processing-time",
        name: "processing-time",
        value: 18,
        unit: "minutes",
        period: "month-1",
        sourceReference: "system-log:3",
      },
      {
        id: "metric-queue-depth",
        name: "queue-depth",
        value: profile.controlIntensity > 0.7 ? 14 : 3,
        unit: "items",
        period: "month-1",
        sourceReference: "system-log:4",
      },
      {
        id: "metric-availability",
        name: "availability",
        value: 0.97,
        unit: "ratio",
        period: "month-1",
        sourceReference: "system-log:5",
      },
      {
        id: "metric-rework",
        name: "rework-rate",
        value: profile.exceptionRate + 0.08,
        unit: "ratio",
        period: "month-1",
        sourceReference: "system-log:6",
      },
    ]);
    const truth = freeze({
      trueProcessStructure: freeze(["capture", "write", "approve"]),
      trueMetrics: freeze({ volume: 62, errorRate: profile.dataQuality < 0.5 ? 0.12 : 0.03 }),
      trueRootCause: process[0]!.rootCause,
      actualBottleneck: process[0]!.bottleneck,
      hiddenCapabilities: freeze(["ERP_WRITE_API"]),
      economicallyJustified: freeze(
        profile.category === "LOW_VALUE_AUTOMATION" ? [] : ["API_SYNCHRONIZATION"],
      ),
      forbiddenRecommendations: freeze(["REMOVE_MANDATORY_APPROVAL"]),
      expectedDecision: profile.category === "LOW_VALUE_AUTOMATION" ? "REJECT" : "QUALIFY",
      expectedHumanControl: profile.controlIntensity > 0.7,
      actualVolumes: freeze({ ordersPerDay: 62 }),
      actualDependencies: freeze(["master-data"]),
      actualControls: freeze(["financial approval"]),
      failureProbabilities: freeze({
        timeout: 0.04,
        dataError: profile.dataQuality < 0.5 ? 0.2 : 0.03,
      }),
      dataQualityState: profile.dataQuality,
      expectedClarifications: freeze(
        profile.category === "AMBIGUOUS" ? ["confirm process owner"] : [],
      ),
      expectedEconomicDirection: (profile.category === "LOW_VALUE_AUTOMATION"
        ? "NEGATIVE"
        : "POSITIVE") as "NEGATIVE" | "POSITIVE",
    });
    return freeze({
      enterpriseId: id,
      seed,
      generatorVersion,
      sector: profile.sector,
      companySize: profile.companySize,
      region: "GLOBAL",
      departments: freeze(["operations", "finance"]),
      roles: freeze(["owner", "manager", "operator", "finance"]),
      actors,
      systems,
      processes: process,
      interviews,
      metrics,
      documents: freeze([
        {
          id: "sop-1",
          type: "SOP",
          content: "Orders are captured, copied and approved.",
          sourceReference: "sop-1",
        },
      ]),
      incidents: freeze([
        {
          id: "incident-1",
          type: profile.category === "DATA_QUALITY_FAILURE" ? "DATA_CORRUPTION" : "VOLUME_SPIKE",
          timestamp: "2026-02-01",
          scope: "order-flow",
          cause: process[0]!.rootCause,
          impact: "processing delay",
          duration: "2h",
        },
      ]),
      events: freeze([{ id: "event-1", type: "VOLUME_SPIKE", timestamp: "2026-01-01" }]),
      timeline: freeze([
        { period: "month-1", change: "baseline" },
        { period: "month-2", change: "volume growth" },
      ]),
      constraints: freeze(["financial approval required"]),
      controls: freeze(["segregation of duties"]),
      risks: freeze(
        profile.riskLevel > 0.7 ? ["high operational risk"] : ["moderate operational risk"],
      ),
      _groundTruth: truth,
    });
  }
  view(enterprise: SyntheticEnterprise): SyntheticEnterpriseView {
    const { _groundTruth, ...view } = enterprise;
    void _groundTruth;
    return freeze(view);
  }
}

export class SyntheticBrainAdapter {
  toEvidence(view: SyntheticEnterpriseView) {
    return freeze(
      view.metrics.map((m) => ({
        id: m.id,
        sourceType: "SYSTEM_RECORD" as const,
        sourceReference: m.sourceReference,
        sourceModule: "work_intelligence" as const,
        capturedAt: new Date("2026-01-01"),
        freshness: "CURRENT" as const,
        reliability: 0.95,
        content: `${m.name}: ${m.value ?? "unknown"} ${m.unit}`,
        structuredValue: m.value,
        provenance: { synthetic: true, generatorVersion: view.generatorVersion },
        tags: ["SYNTHETIC_TEST"],
        tenantId: `synthetic:${view.enterpriseId}`,
      })),
    );
  }
}

export function toScenarioDataset(
  generator: SyntheticEnterpriseGenerator,
  scenarioId: string,
  seed: string,
  generatorVersion: string,
  profile: SyntheticScenarioProfile,
): ScenarioDataset {
  const enterprise = generator.generate(seed, generatorVersion, profile);
  return freeze({
    scenarioId,
    generatorVersion,
    seed,
    publicView: generator.view(enterprise),
    groundTruthReference: `synthetic-ground-truth:${enterprise.enterpriseId}`,
    evaluationExpectations: {
      expectedRootCauseIds: freeze([enterprise._groundTruth.trueRootCause]),
      expectedOpportunityTypes: freeze(enterprise._groundTruth.economicallyJustified),
      forbiddenOpportunityTypes: freeze(enterprise._groundTruth.forbiddenRecommendations),
      expectedDecisionClass: enterprise._groundTruth.expectedDecision,
      expectedHumanControl: enterprise._groundTruth.expectedHumanControl,
      expectedUnknowns: freeze(enterprise._groundTruth.expectedClarifications),
    },
    tags: freeze(["SYNTHETIC", profile.category]),
  });
}

export function createScenarioLibrary() {
  const base: SyntheticScenarioProfile = {
    sector: "cross-sector",
    companySize: "SMB",
    processComplexity: 0.5,
    dataQuality: 0.8,
    automationMaturity: 0.3,
    systemFragmentation: 0.6,
    humanDependency: 0.5,
    exceptionRate: 0.1,
    controlIntensity: 0.5,
    documentationQuality: 0.6,
    organizationalMaturity: 0.6,
    riskLevel: 0.3,
    category: "HIGH_VALUE_AUTOMATION",
  };
  const names: [string, SyntheticScenarioCategory][] = [
    ["crm-erp-reentry", "SYSTEM_FRAGMENTATION"],
    ["wrong-root-cause", "AMBIGUOUS"],
    ["approval-bottleneck", "HUMAN_CONTROL_REQUIRED"],
    ["broken-master-data", "DATA_QUALITY_FAILURE"],
    ["single-person", "SINGLE_PERSON_DEPENDENCY"],
    ["high-rework", "HIGH_REWORK"],
    ["low-value", "LOW_VALUE_AUTOMATION"],
    ["high-risk-ai", "HIGH_RISK_AI"],
    ["api-unknown", "AMBIGUOUS"],
    ["conflicting-volume", "CONTRADICTORY"],
    ["hidden-bottleneck", "BROKEN_PROCESS"],
    ["observability-gap", "OBSERVABILITY_GAP"],
  ];
  return names.map(([seed, category]) => ({
    seed,
    profile: {
      ...base,
      category,
      controlIntensity: category === "HUMAN_CONTROL_REQUIRED" ? 0.9 : base.controlIntensity,
      dataQuality: category === "DATA_QUALITY_FAILURE" ? 0.3 : base.dataQuality,
    },
  }));
}

export function createAdversarialScenarioLibrary(): ScenarioDataset[] {
  const generator = new SyntheticEnterpriseGenerator();
  const base = createScenarioLibrary()[0]!.profile;
  const cases: Array<[string, SyntheticScenarioProfile]> = [
    ["confident-wrong-manager", { ...base, category: "AMBIGUOUS" }],
    ["weak-outlier", { ...base, category: "CONTRADICTORY" }],
    ["misleading-symptom", { ...base, category: "DATA_QUALITY_FAILURE" }],
    ["negative-economics", { ...base, category: "LOW_VALUE_AUTOMATION" }],
  ];
  return cases.map(([scenarioId, profile]) =>
    toScenarioDataset(generator, `adversarial:${scenarioId}`, scenarioId, "v1", profile),
  );
}
