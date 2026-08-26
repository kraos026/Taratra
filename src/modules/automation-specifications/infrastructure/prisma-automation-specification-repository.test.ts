import { describe, expect, it, vi } from "vitest";
import { AutomationSpecificationEngine } from "../domain/automation-specification-engine";
import type {
  AutomationSpecificationInput,
  SpecificationRule,
} from "../domain/automation-specification";
import { AutomationSpecificationConflictError } from "../application/automation-specification-errors";
import {
  prepareAutomationSpecificationPersistencePlan,
  PrismaAutomationSpecificationRepository,
} from "./prisma-automation-specification-repository";

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

function canonicalInput(): AutomationSpecificationInput {
  const transformations = [
    "project_triggers",
    "project_data_contracts",
    "project_steps",
    "project_dependencies",
    "project_controls",
    "project_error_policies",
    "project_security",
    "project_observability",
    "project_acceptance_criteria",
  ] as const;
  const validations = [
    "source_published",
    "elements_present",
    "unique_local_ids",
    "references_valid",
    "graph_acyclic",
    "data_contracts_resolved",
    "provenance_complete",
  ] as const;
  const rules: SpecificationRule[] = [
    ...transformations.map((decision, index) => ({
      id: `transformation-${index}`,
      code: decision,
      version: 1,
      ruleType: "transformation" as const,
      decision,
      description: decision,
      published: true,
    })),
    ...validations.map((operator, index) => ({
      id: `validation-${index}`,
      code: operator,
      version: 1,
      ruleType: "validation" as const,
      operator,
      severity: "error" as const,
      description: operator,
      published: true,
    })),
  ];

  return {
    blueprint: {
      id: "33333333-3333-4333-8333-333333333333",
      organizationId,
      versionNumber: 1,
      status: "published",
      name: "Invoice processing automation",
      objective: "Automate invoice processing",
      components: [
        { code: "ingest", name: "Ingest invoices" },
        { code: "validate", name: "Validate invoices" },
        { code: "post", name: "Post invoices" },
      ],
      capabilities: [
        { code: "ocr", name: "OCR" },
        { code: "extraction", name: "Data extraction" },
        { code: "matching", name: "Three-way matching" },
        { code: "routing", name: "Approval routing" },
        { code: "audit", name: "Audit trail" },
      ],
      connectors: [
        connector("generic_relational_database", 2),
        connector("generic_analytics_provider", 2),
        connector("generic_notification_provider", 1),
        connector("generic_logging_provider", 2),
        connector("generic_monitoring_provider", 2),
      ],
      constraints: Array.from({ length: 8 }, (_, index) => ({
        code: `constraint_${index + 1}`,
        name: `Constraint ${index + 1}`,
      })),
      inputs: ["Invoice email", "Invoice PDF", "Supplier master", "Purchase order", "Receipt"],
      outputs: [
        "Validated invoice",
        "Exception queue",
        "Approval request",
        "ERP posting",
        "Audit event",
      ],
      topology: [
        { from: "ingest", to: "validate", type: "calls", label: "Validate" },
        { from: "validate", to: "post", type: "calls", label: "Post" },
        { from: "validate", to: "post", type: "stores", label: "Store audit event" },
      ],
    },
    rules,
  };
}

function connector(code: string, permissions: number) {
  return {
    code,
    name: code,
    inputs: [],
    outputs: [],
    secrets: [`${code}.secret`],
    permissions: Array.from({ length: permissions }, (_, index) => `${code}.permission.${index}`),
  };
}

function database(overrides: Record<string, unknown> = {}) {
  const db = {
    $executeRaw: vi.fn().mockResolvedValue(undefined),
    automationSpecification: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          ...data,
          status: "draft",
          lockVersion: 1,
          versionNumber: data.versionNumber,
        }),
      ),
    },
    automationSpecificationElement: {
      createMany: vi.fn().mockResolvedValue({ count: 54 }),
    },
    automationSpecificationProvenance: {
      createMany: vi.fn().mockResolvedValue({ count: 69 }),
    },
    automationSpecificationValidation: {
      createMany: vi.fn().mockResolvedValue({ count: 7 }),
    },
    ...overrides,
  };
  return db;
}

describe("PrismaAutomationSpecificationRepository", () => {
  it("prepares the canonical specification as flat rows without losing provenance", () => {
    const input = canonicalInput();
    const result = new AutomationSpecificationEngine().generate(input);
    const plan = prepareAutomationSpecificationPersistencePlan(
      organizationId,
      userId,
      input,
      result,
    );

    expect(plan.elementRows).toHaveLength(54);
    expect(plan.provenanceRows).toHaveLength(69);
    expect(plan.validationRows).toHaveLength(7);
    expect(new Set(plan.elementRows.map((row) => row.id)).size).toBe(54);
    expect(new Set(plan.provenanceRows.map((row) => row.id)).size).toBe(69);
    expect(
      plan.provenanceRows.every(
        (row) => row.automationSpecificationId === plan.specificationHeader.id,
      ),
    ).toBe(true);
  });

  it("persists provenance with createMany instead of per-row raw inserts", async () => {
    const input = canonicalInput();
    const result = new AutomationSpecificationEngine().generate(input);
    const plan = prepareAutomationSpecificationPersistencePlan(
      organizationId,
      userId,
      input,
      result,
    );
    const db = database();

    await new PrismaAutomationSpecificationRepository(db as never).persistPrepared(
      organizationId,
      plan,
      null,
    );

    expect(db.$executeRaw).toHaveBeenCalledTimes(2);
    expect(db.automationSpecificationElement.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ automationSpecificationId: plan.specificationHeader.id }),
      ]),
    });
    expect(db.automationSpecificationProvenance.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ automationSpecificationId: plan.specificationHeader.id }),
      ]),
    });
    expect(db.automationSpecificationProvenance.createMany.mock.calls[0][0].data).toHaveLength(69);
    expect(db.automationSpecificationValidation.createMany.mock.calls[0][0].data).toHaveLength(7);
  });

  it("propagates provenance batch failure before validation writes so the transaction can roll back", async () => {
    const input = canonicalInput();
    const result = new AutomationSpecificationEngine().generate(input);
    const plan = prepareAutomationSpecificationPersistencePlan(
      organizationId,
      userId,
      input,
      result,
    );
    const db = database({
      automationSpecificationProvenance: {
        createMany: vi.fn().mockRejectedValue(new Error("provenance batch failed")),
      },
    });

    await expect(
      new PrismaAutomationSpecificationRepository(db as never).persistPrepared(
        organizationId,
        plan,
        null,
      ),
    ).rejects.toThrow("provenance batch failed");

    expect(db.automationSpecificationValidation.createMany).not.toHaveBeenCalled();
  });

  it("rejects a duplicate first-version write when a latest specification already exists", async () => {
    const input = canonicalInput();
    const result = new AutomationSpecificationEngine().generate(input);
    const plan = prepareAutomationSpecificationPersistencePlan(
      organizationId,
      userId,
      input,
      result,
    );
    const db = database({
      automationSpecification: {
        findFirst: vi.fn().mockResolvedValue({
          id: "44444444-4444-4444-8444-444444444444",
          versionNumber: 1,
        }),
        create: vi.fn(),
      },
    });

    await expect(
      new PrismaAutomationSpecificationRepository(db as never).persistPrepared(
        organizationId,
        plan,
        null,
      ),
    ).rejects.toBeInstanceOf(AutomationSpecificationConflictError);

    expect(db.automationSpecification.create).not.toHaveBeenCalled();
    expect(db.automationSpecificationElement.createMany).not.toHaveBeenCalled();
  });

  it("increments the version when revising the latest specification explicitly", async () => {
    const input = canonicalInput();
    const result = new AutomationSpecificationEngine().generate(input);
    const plan = prepareAutomationSpecificationPersistencePlan(
      organizationId,
      userId,
      input,
      result,
    );
    const previousVersionId = "44444444-4444-4444-8444-444444444444";
    const db = database({
      automationSpecification: {
        findFirst: vi.fn().mockResolvedValue({
          id: previousVersionId,
          versionNumber: 3,
        }),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      },
    });

    await new PrismaAutomationSpecificationRepository(db as never).persistPrepared(
      organizationId,
      plan,
      previousVersionId,
    );

    expect(db.automationSpecification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        previousVersionId,
        versionNumber: 4,
      }),
    });
  });
});
