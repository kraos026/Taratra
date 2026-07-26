import { describe, expect, it } from "vitest";
import { SolutionDesigner, type DesignerInput, type PatternTemplate } from "./solution-designer";

const template: PatternTemplate = {
  components: [
    { code: "trigger", name: "Trigger" },
    { code: "action", name: "Action" },
  ],
  capabilities: ["scheduler", "api_client", "notification"],
  connectors: [{ code: "scheduler" }, { code: "api" }, { code: "notification" }],
  constraints: ["auth", "authorization", "idempotency", "retry", "observability"],
  secrets: ["API credential", "Notification credential"],
  permissions: ["schedule.create", "api.read", "api.write", "notification.send"],
  edges: [
    { from: "trigger", to: "action", type: "schedules", label: "schedule" },
    { from: "action", to: "trigger", type: "notifies", label: "notify completion" },
  ],
  risks: [
    { name: "External service", severity: 25, costIndex: 10 },
    { name: "Duplicate execution", severity: 50, costIndex: 20 },
  ],
  normalization: {
    componentFactor: 10,
    connectorFactor: 15,
    dependencyFactor: 10,
    constraintFactor: 20,
    weights: { components: 0.4, connectors: 0.3, dependencies: 0.2, constraints: 0.1 },
    complexityCostFactor: 0.5,
    dependencyEdgeTypes: ["produces", "consumes", "calls", "stores", "approves", "schedules"],
  },
};
const input = (): DesignerInput => ({
  source: {
    recommendationId: "recommendation",
    recommendationIdentifier: "rec",
    recommendationTitle: "Automate invoicing",
    recommendationDescription: "Reduce manual work",
    recommendationCategory: "quick_wins",
    recommendationStatus: "published",
    recommendationSnapshotId: "recommendation-snapshot",
    roiSnapshotId: "roi",
    roiStatus: "published",
    automationOpportunityId: "automation",
    automationSnapshotId: "automation-snapshot",
    automationStatus: "published",
    companyId: "company",
    evidenceIds: ["evidence"],
  },
  patterns: [
    {
      id: "pattern",
      code: "simple_automation",
      name: "Simple Automation",
      version: 1,
      recommendationCategories: ["quick_wins"],
      template,
      published: true,
    },
  ],
  capabilities: [
    { id: "1", code: "scheduler", name: "Scheduler", version: 1, costIndex: 5, published: true },
    { id: "2", code: "api_client", name: "API", version: 1, costIndex: 15, published: true },
    {
      id: "3",
      code: "notification",
      name: "Notification",
      version: 1,
      costIndex: 5,
      published: true,
    },
  ],
  connectors: [
    {
      id: "4",
      code: "scheduler",
      name: "Scheduler",
      version: 1,
      costIndex: 10,
      capabilities: ["scheduler"],
      secrets: [],
      permissions: ["schedule.create"],
      inputs: ["schedule"],
      outputs: ["trigger"],
      published: true,
    },
    {
      id: "5",
      code: "api",
      name: "API",
      version: 1,
      costIndex: 25,
      capabilities: ["api_client"],
      secrets: ["API credential"],
      permissions: ["api.read", "api.write"],
      inputs: ["request"],
      outputs: ["response"],
      published: true,
    },
    {
      id: "6",
      code: "notification",
      name: "Notification",
      version: 1,
      costIndex: 10,
      capabilities: ["notification"],
      secrets: ["Notification credential"],
      permissions: ["notification.send"],
      inputs: ["message"],
      outputs: ["status"],
      published: true,
    },
  ],
  constraints: template.constraints.map((code) => ({
    id: code,
    code,
    name: code,
    version: 1,
    published: true,
  })),
});
describe("SolutionDesigner", () => {
  const designer = new SolutionDesigner();
  it("selects the catalog pattern and calculates deterministic complexity and cost", () => {
    const result = designer.generate(input());
    expect(result.pattern?.code).toBe("simple_automation");
    expect(result.complexityScore).toBe(36);
    expect(result.estimatedTechnicalCostIndex).toBe(108);
    expect(result.finalRisk).toBe(50);
    expect(result.validations).toEqual([expect.objectContaining({ code: "blueprint_valid" })]);
  });
  it("is deterministic on rebuild", () =>
    expect(designer.rebuild(input())).toEqual(designer.generate(input())));
  it("blocks an execution dependency cycle", () => {
    const value = input();
    value.patterns[0]!.template.edges.push({
      from: "action",
      to: "trigger",
      type: "calls",
      label: "cycle",
    });
    expect(designer.generate(value).validations).toContainEqual(
      expect.objectContaining({ code: "topology_cycle" }),
    );
  });
  it("blocks unpublished canonical sources", () => {
    const value = input();
    value.source.roiStatus = "draft";
    expect(designer.generate(value).validations).toContainEqual(
      expect.objectContaining({ code: "roi_unpublished" }),
    );
  });
  it("blocks missing evidence and unknown capabilities", () => {
    const value = input();
    value.source.evidenceIds = [];
    value.capabilities = value.capabilities.slice(0, 2);
    const codes = designer.generate(value).validations.map((item) => item.code);
    expect(codes).toEqual(expect.arrayContaining(["missing_evidence", "unknown_capability"]));
  });
  it("rejects forbidden platform names", () => {
    const value = input();
    value.patterns[0]!.name = "Zapier";
    expect(designer.generate(value).validations).toContainEqual(
      expect.objectContaining({ code: "forbidden_platform" }),
    );
  });
});
